-- ============================================================================
-- Registro administrativo de pagamentos de renovação. Não é sistema
-- financeiro nem gateway: a assinatura continua dependendo só de
-- `renew_client`. O registro é opcional e só existe quando o admin informa
-- valor, forma de pagamento ou observação ao renovar.
--
-- Valor em centavos (inteiro): sem erro de arredondamento.
-- Acesso: só administrador. Registro imutável (sem update/delete pela API),
-- para o histórico não ser reescrito; some junto com o cliente (cascade).
-- ============================================================================

create table if not exists public.client_payments (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  months smallint not null check (months in (3, 6, 12)),
  amount_cents integer check (amount_cents is null or amount_cents between 0 and 100000000),
  method text check (method is null or method in ('pix', 'dinheiro', 'cartao', 'outro')),
  paid_on date not null default current_date,
  note text check (note is null or length(btrim(note)) between 1 and 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

create index if not exists client_payments_client_id_idx on public.client_payments (client_id, paid_on desc);

revoke all on public.client_payments from anon, authenticated;
grant select, insert on public.client_payments to authenticated;

alter table public.client_payments enable row level security;
alter table public.client_payments force row level security;

create policy client_payments_select_admin on public.client_payments
  for select to authenticated
  using ((select private.is_admin()));

create policy client_payments_insert_admin on public.client_payments
  for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Renovar e (opcionalmente) registrar o pagamento numa transação só: ou os
-- dois acontecem, ou nenhum. A auditoria de "renovado" já vem de
-- `renew_client`; a do pagamento leva só meses, valor e forma (sem a
-- observação, que é texto livre).
-- ---------------------------------------------------------------------------
create or replace function public.renew_client_with_payment(
  p_client_id uuid,
  p_months integer,
  p_amount_cents integer default null,
  p_method text default null,
  p_paid_on date default null,
  p_note text default null
)
returns public.clients
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client public.clients%rowtype;
begin
  v_client := public.renew_client(p_client_id, p_months);

  if p_amount_cents is not null or p_method is not null or nullif(btrim(p_note), '') is not null then
    insert into public.client_payments (client_id, months, amount_cents, method, paid_on, note)
    values (p_client_id, p_months, p_amount_cents, p_method, coalesce(p_paid_on, current_date), nullif(btrim(p_note), ''));

    insert into public.admin_audit_log (action, client_id, client_username, client_full_name, actor_id, detail)
    values ('payment_recorded', v_client.id, v_client.username, v_client.full_name, (select auth.uid()),
      jsonb_build_object('months', p_months, 'amount_cents', p_amount_cents, 'method', p_method));
  end if;

  return v_client;
end;
$$;

revoke execute on function public.renew_client_with_payment(uuid, integer, integer, text, date, text) from public;
grant execute on function public.renew_client_with_payment(uuid, integer, integer, text, date, text) to authenticated;
