-- ============================================================================
-- Painel do cliente: trava edição/publicação fora do status ATIVO.
--
-- Achado ao construir o painel, não suposição: hoje um cliente CANCELADO
-- ainda consegue editar o rascunho e publicar — nada no banco impede. O PRD
-- §22 lista edição e publicação como características do status ATIVO
-- especificamente ("Quando o cliente estiver ativo: ... edição disponível;
-- publicação disponível"), sugerindo que não valem fora dele. Interpretação
-- provisória, mas já aplicada onde importa: no banco, não só escondendo
-- botão na tela — reversível se a leitura correta for outra (P5, ainda
-- registrada como aberta em docs/PERGUNTAS-ABERTAS.md).
--
-- Leitura do próprio rascunho/publicado continua liberada sempre — só a
-- ESCRITA fica presa ao status.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper reutilizável: este cliente está ativo agora? `security definer`
-- porque precisa ler `clients` mesmo de dentro de `publish_card`/
-- `restore_draft`, que já são definer e por isso não herdam RLS nenhuma —
-- teria que ser definer de qualquer forma para funcionar lá dentro.
-- ---------------------------------------------------------------------------
create or replace function private.client_is_active(p_client_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (
      select public.effective_status(expires_at, cancelled_at) = 'active'
      from public.clients where id = p_client_id
    ),
    false
  );
$$;

revoke execute on function private.client_is_active(uuid) from public;
grant execute on function private.client_is_active(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rascunho só é editável com o cliente ativo. Leitura (`card_drafts_select_own`,
-- da etapa 3) não muda.
-- ---------------------------------------------------------------------------
drop policy if exists card_drafts_update_own on public.card_drafts;
create policy card_drafts_update_own on public.card_drafts
  for update to authenticated
  using (
    client_id = (select auth.uid())
    and (select private.client_is_active((select auth.uid())))
  )
  with check (client_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- `publish_card`/`restore_draft` são `security definer` (decisão da etapa 7)
-- — bypassam RLS por completo, então a checagem de status precisa estar
-- dentro do corpo da função, explícita, não só na política.
-- ---------------------------------------------------------------------------
create or replace function public.publish_card()
returns public.card_published
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.card_drafts%rowtype;
  v_published public.card_published%rowtype;
begin
  if not private.client_is_active((select auth.uid())) then
    raise exception 'Seu cartão não está ativo. Renove para voltar a publicar alterações.';
  end if;

  select * into v_draft from public.card_drafts where client_id = (select auth.uid());
  if not found then
    raise exception 'Nenhum rascunho encontrado para publicar.';
  end if;

  if not public.validate_card_content(v_draft.content, true) then
    raise exception 'O cartão precisa de nome, cor de fundo e cor dos botões válidos antes de publicar.';
  end if;

  insert into public.card_published (client_id, content, published_at)
  values ((select auth.uid()), v_draft.content, now())
  on conflict (client_id) do update
    set content = excluded.content, published_at = excluded.published_at
  returning * into v_published;

  return v_published;
end;
$$;

create or replace function public.restore_draft()
returns public.card_drafts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_published public.card_published%rowtype;
  v_draft public.card_drafts%rowtype;
begin
  if not private.client_is_active((select auth.uid())) then
    raise exception 'Seu cartão não está ativo. Renove para voltar a editar.';
  end if;

  select * into v_published from public.card_published where client_id = (select auth.uid());
  if not found then
    raise exception 'Nenhuma versão publicada para restaurar.';
  end if;

  update public.card_drafts
    set content = v_published.content
    where client_id = (select auth.uid())
    returning * into v_draft;

  if not found then
    raise exception 'Não foi possível restaurar: rascunho não encontrado.';
  end if;

  return v_draft;
end;
$$;
