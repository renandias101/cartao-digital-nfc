-- Cadastro do cliente com pagamento inicial opcional na mesma transacao.
create or replace function public.admin_create_client_record(
  p_client_id uuid,
  p_username text,
  p_full_name text,
  p_package_months integer,
  p_expires_at timestamptz,
  p_content jsonb,
  p_actor_id uuid,
  p_amount_cents integer default null,
  p_method text default null,
  p_paid_on date default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.admins where user_id = p_actor_id) then
    raise exception 'Nao autorizado.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.clients (id, username, full_name, package_months, expires_at)
  values (p_client_id, p_username, p_full_name, p_package_months, p_expires_at);
  insert into public.card_drafts (client_id, content) values (p_client_id, p_content);
  insert into public.admin_audit_log
    (action, client_id, client_username, client_full_name, actor_id, detail)
  values
    ('client_created', p_client_id, p_username, p_full_name, p_actor_id,
     jsonb_build_object('package_months', p_package_months, 'expires_at', p_expires_at));

  if p_amount_cents is not null or p_method is not null or nullif(btrim(p_note), '') is not null then
    insert into public.client_payments
      (client_id, months, amount_cents, method, paid_on, note, created_by)
    values
      (p_client_id, p_package_months, p_amount_cents, p_method,
       coalesce(p_paid_on, current_date), nullif(btrim(p_note), ''), p_actor_id);

    insert into public.admin_audit_log
      (action, client_id, client_username, client_full_name, actor_id, detail)
    values
      ('payment_recorded', p_client_id, p_username, p_full_name, p_actor_id,
       jsonb_build_object('months', p_package_months, 'amount_cents', p_amount_cents, 'method', p_method));
  end if;
end;
$$;

revoke execute on function public.admin_create_client_record(
  uuid, text, text, integer, timestamptz, jsonb, uuid, integer, text, date, text
) from public;
grant execute on function public.admin_create_client_record(
  uuid, text, text, integer, timestamptz, jsonb, uuid, integer, text, date, text
) to service_role;
