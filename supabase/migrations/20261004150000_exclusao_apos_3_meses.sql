-- ============================================================================
-- Exclusão só depois de 3 meses cancelado (decisão do usuário, 04/10/2026).
--
-- Fluxo: ATIVO → VENCIDO → (15 dias) CANCELADO → (3 meses) elegível →
-- exclusão MANUAL pelo administrador. Mais restrito que o PRD §34/§66
-- ("somente cancelados"): continua valendo, só ganha a carência.
--
-- Data do cancelamento: `cancelled_at` quando o admin cancelou à mão; senão,
-- o cancelamento automático, que é `expires_at + 15 dias` — a mesma regra de
-- `effective_status`. A trava fica na POLÍTICA de delete (não só na função),
-- para valer até para quem chama a API de dados direto.
-- ============================================================================

-- Data do cancelamento efetivo (null se o cliente não está cancelado).
create or replace function public.client_cancelled_on(
  p_expires_at timestamptz,
  p_cancelled_at timestamptz
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when public.effective_status(p_expires_at, p_cancelled_at) = 'cancelled'
      then coalesce(p_cancelled_at, p_expires_at + interval '15 days')
  end;
$$;

-- A partir de quando a exclusão é permitida (null se não está cancelado).
create or replace function public.client_deletion_eligible_at(
  p_expires_at timestamptz,
  p_cancelled_at timestamptz
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select public.client_cancelled_on(p_expires_at, p_cancelled_at) + interval '3 months';
$$;

revoke execute on function public.client_cancelled_on(timestamptz, timestamptz) from public;
revoke execute on function public.client_deletion_eligible_at(timestamptz, timestamptz) from public;
grant execute on function public.client_cancelled_on(timestamptz, timestamptz) to authenticated;
grant execute on function public.client_deletion_eligible_at(timestamptz, timestamptz) to authenticated;

-- ALTER POLICY (em vez de recriar): a política nunca deixa de existir no meio.
alter policy clients_delete_admin on public.clients
  using (
    (select private.is_admin())
    and coalesce(public.client_deletion_eligible_at(expires_at, cancelled_at) <= now(), false)
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
    raise exception 'Exclusão não permitida: o cliente precisa estar cancelado há pelo menos 3 meses.';
  end if;
end;
$$;
