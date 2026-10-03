-- ============================================================================
-- Motor de vencimento e renovação
--
-- Dois fatos confirmados diretamente no Postgres antes de escrever isto (não
-- por suposição):
--  1. `date + interval 'N months'` já ajusta corretamente o fim de mês —
--     30/11 + 3 meses = 28/02, sem lógica manual de clamping.
--  2. `America/Belem` tem offset fixo -03:00 o ano inteiro (Brasil aboliu o
--     horário de verão em 2019) — testado em janeiro e em julho, mesmo
--     deslocamento nos dois.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Calcula o novo vencimento (PRD §30, §31).
--
-- Convenção de armazenamento: `expires_at` guarda o INÍCIO do dia seguinte ao
-- último dia válido, em America/Belem, convertido para UTC. Isso representa
-- "vence no fim do dia D" sem lidar com arredondamento de 23:59:59.999... —
-- o último instante de D permanece ativo, e a mudança de status acontece
-- exatamente na virada para D+1 (`effective_status` já compara com `>`).
--
-- Para recuperar D a partir de um `expires_at` existente, subtrai-se um
-- microssegundo antes de converter para o fuso: isso funciona mesmo que o
-- valor armazenado não caia exatamente à meia-noite, então não depende de um
-- invariante frágil sobre como o valor foi escrito.
-- ---------------------------------------------------------------------------
create or replace function public.compute_new_expiry(
  p_current_expires_at timestamptz,
  p_current_cancelled_at timestamptz,
  p_package_months integer
)
returns timestamptz
language plpgsql
set search_path = ''
stable
as $$
declare
  v_status text := public.effective_status(p_current_expires_at, p_current_cancelled_at);
  v_base_date date;
  v_new_date date;
begin
  if v_status = 'active' then
    -- soma ao vencimento atual (PRD §30)
    v_base_date := ((p_current_expires_at - interval '1 microsecond')
                     at time zone 'America/Belem')::date;
  else
    -- conta a partir de agora (PRD §31)
    v_base_date := (now() at time zone 'America/Belem')::date;
  end if;

  v_new_date := v_base_date + make_interval(months => p_package_months);

  return ((v_new_date + interval '1 day')::timestamp at time zone 'America/Belem');
end;
$$;

revoke execute on function public.compute_new_expiry(timestamptz, timestamptz, integer) from public;
-- `renew_client` (abaixo) roda como quem chamou (security invoker) e precisa
-- conseguir invocar esta função — mesma lição da D17 (USAGE/EXECUTE valem
-- para o papel de quem chama, não para o dono da função). É pura função de
-- cálculo, sem ligação com nenhum cliente específico: não há dado sensível
-- em expor o cálculo em si.
grant execute on function public.compute_new_expiry(timestamptz, timestamptz, integer) to authenticated;
-- O fluxo de cadastro de cliente (etapa 6) roda pelo cliente de serviço, para
-- poder criar o usuário no Auth antes de existir qualquer sessão; por isso
-- precisa do mesmo grant.
grant execute on function public.compute_new_expiry(timestamptz, timestamptz, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Renovar (PRD §29, §30, §31, §64).
--
-- Autorização por RLS, não duplicada aqui: a política `clients_update_admin`
-- já exige `private.is_admin()`. Se a atualização não afetar nenhuma linha,
-- é porque a política negou (ou o cliente não existe) — a função detecta
-- isso por `FOUND` e devolve um erro claro, em vez de mentir que funcionou.
-- ---------------------------------------------------------------------------
create or replace function public.renew_client(p_client_id uuid, p_months integer)
returns public.clients
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_antes public.clients%rowtype;
  v_depois public.clients%rowtype;
  v_novo_vencimento timestamptz;
begin
  if p_months not in (3, 6, 12) then
    raise exception 'Pacote inválido: %. Use 3, 6 ou 12 meses.', p_months;
  end if;

  select * into v_antes from public.clients where id = p_client_id;
  if not found then
    raise exception 'Cliente não encontrado ou sem permissão.';
  end if;

  v_novo_vencimento := public.compute_new_expiry(v_antes.expires_at, v_antes.cancelled_at, p_months);

  update public.clients
    set expires_at = v_novo_vencimento,
        cancelled_at = null,
        package_months = p_months,
        last_renewed_at = now()
    where id = p_client_id
    returning * into v_depois;

  if not found then
    raise exception 'Não foi possível renovar: sem permissão.';
  end if;

  insert into public.admin_audit_log
    (action, client_id, client_username, client_full_name, actor_id, detail)
  values (
    'renewed', v_depois.id, v_depois.username, v_depois.full_name, (select auth.uid()),
    jsonb_build_object(
      'months', p_months,
      'previous_expires_at', v_antes.expires_at,
      'previous_status', public.effective_status(v_antes.expires_at, v_antes.cancelled_at),
      'new_expires_at', v_novo_vencimento
    )
  );

  return v_depois;
end;
$$;

revoke execute on function public.renew_client(uuid, integer) from public;
grant execute on function public.renew_client(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancelar manualmente (PRD §33 parcial, decisão P3).
--
-- Admin pode cancelar de qualquer status. `expires_at` é preservado — só
-- `cancelled_at` muda. `coalesce` evita sobrescrever a data original de um
-- cancelamento se a função for chamada duas vezes (idempotente).
-- ---------------------------------------------------------------------------
create or replace function public.cancel_client(p_client_id uuid)
returns public.clients
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_antes public.clients%rowtype;
  v_depois public.clients%rowtype;
begin
  select * into v_antes from public.clients where id = p_client_id;
  if not found then
    raise exception 'Cliente não encontrado ou sem permissão.';
  end if;

  update public.clients
    set cancelled_at = coalesce(cancelled_at, now())
    where id = p_client_id
    returning * into v_depois;

  if not found then
    raise exception 'Cliente não encontrado ou sem permissão.';
  end if;

  -- Só registra quando o cancelamento é novo. Chamar de novo um cliente já
  -- cancelado é no-op por causa do `coalesce` acima, e um no-op não é uma
  -- ação administrativa nova — repetir o log a cada chamada inflaria o
  -- histórico do PRD §40 sem nenhuma informação a mais.
  if v_antes.cancelled_at is null then
    insert into public.admin_audit_log
      (action, client_id, client_username, client_full_name, actor_id, detail)
    values (
      'cancelled', v_depois.id, v_depois.username, v_depois.full_name, (select auth.uid()),
      jsonb_build_object('expires_at_preservado', v_depois.expires_at)
    );
  end if;

  return v_depois;
end;
$$;

revoke execute on function public.cancel_client(uuid) from public;
grant execute on function public.cancel_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Excluir (PRD §33, §34, §66: "somente clientes cancelados podem ser
-- excluídos" é critério de aceite — por isso a regra vai na própria política
-- de RLS, não só nesta função. Mesmo um admin chamando a API de dados
-- diretamente, por fora desta função, esbarra na mesma trava.
-- ---------------------------------------------------------------------------
drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin on public.clients
  for delete to authenticated
  using (
    (select private.is_admin())
    and public.effective_status(expires_at, cancelled_at) = 'cancelled'
  );

create or replace function public.delete_client(p_client_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.clients where id = p_client_id;
  if not found then
    raise exception 'Cliente não encontrado, não cancelado, ou sem permissão.';
  end if;
end;
$$;

revoke execute on function public.delete_client(uuid) from public;
grant execute on function public.delete_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Registro automático da exclusão (PRD §40), por gatilho — não só dentro de
-- `delete_client`. Cobre também uma exclusão feita por fora da aplicação
-- (por exemplo, apagando o usuário direto no painel do Supabase), que
-- cascateia para `clients` via `ON DELETE CASCADE` e não passaria pela
-- função acima.
-- ---------------------------------------------------------------------------
create or replace function public.log_client_deletion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- client_id vai NULL desde já, não `old.id`: no instante em que este
  -- gatilho AFTER DELETE roda, a linha em `clients` já foi removida — inserir
  -- uma referência a ela violaria a própria FK que criamos. O snapshot em
  -- username/full_name é o que sobrevive de propósito (D2/conflito C2).
  insert into public.admin_audit_log (action, client_id, client_username, client_full_name, actor_id)
  values ('deleted', null, old.username, old.full_name, (select auth.uid()));
  return old;
end;
$$;

create trigger clients_log_deletion
  after delete on public.clients
  for each row execute function public.log_client_deletion();
