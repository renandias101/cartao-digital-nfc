-- Pedidos públicos de redefinição, sem revelar existência ou estado da conta.
insert into public.reserved_usernames (username, reason)
values ('esqueci-senha', 'system')
on conflict (username) do nothing;

create table public.password_reset_requests (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients (id) on delete set null,
  requested_username text not null,
  client_username text not null,
  client_full_name text not null,
  status text not null default 'pending' check (status in ('pending', 'attended', 'closed')),
  requested_at timestamptz not null default now(),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  result text check (result in ('password_reset', 'closed_without_reset')),
  resolution_reason text check (resolution_reason is null or length(resolution_reason) between 3 and 500),
  constraint password_reset_requests_resolution_check check (
    (status = 'pending' and handled_by is null and handled_at is null and result is null and resolution_reason is null)
    or
    (status = 'attended' and handled_by is not null and handled_at is not null and result = 'password_reset' and resolution_reason is null)
    or
    (status = 'closed' and handled_by is not null and handled_at is not null and result = 'closed_without_reset' and resolution_reason is not null)
  )
);

create unique index password_reset_requests_one_pending_per_client
  on public.password_reset_requests (client_id) where status = 'pending' and client_id is not null;
create index password_reset_requests_status_requested_idx
  on public.password_reset_requests (status, requested_at desc);
create index password_reset_requests_client_idx
  on public.password_reset_requests (client_id) where client_id is not null;

create table private.password_reset_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  source_hash text not null check (length(source_hash) = 64),
  created_at timestamptz not null default now()
);

create index password_reset_attempts_username_created_idx
  on private.password_reset_attempts (username, created_at desc);
create index password_reset_attempts_source_created_idx
  on private.password_reset_attempts (source_hash, created_at desc);

revoke all on public.password_reset_requests from anon, authenticated;
grant select, update on public.password_reset_requests to authenticated;
alter table public.password_reset_requests enable row level security;
alter table public.password_reset_requests force row level security;

create policy password_reset_requests_select_admin on public.password_reset_requests
  for select to authenticated using ((select private.is_admin()));

create policy password_reset_requests_update_admin on public.password_reset_requests
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Chamado apenas pelo servidor com a chave secreta. Registra toda tentativa
-- antes de procurar a conta, mantendo o limite igual para nomes válidos ou não.
create or replace function public.request_password_reset(p_username text, p_source_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_client public.clients%rowtype;
begin
  if length(v_username) < 1 or length(v_username) > 64 or p_source_hash !~ '^[0-9a-f]{64}$' then
    return 'accepted';
  end if;

  delete from private.password_reset_attempts where created_at < now() - interval '24 hours';

  if (select count(*) from private.password_reset_attempts where source_hash = p_source_hash and created_at > now() - interval '1 hour') >= 10
     or (select count(*) from private.password_reset_attempts where username = v_username and created_at > now() - interval '1 hour') >= 3 then
    return 'rate_limited';
  end if;

  insert into private.password_reset_attempts (username, source_hash) values (v_username, p_source_hash);

  select * into v_client
  from public.clients
  where username = v_username
    and public.effective_status(expires_at, cancelled_at) = 'active';

  if found then
    insert into public.password_reset_requests
      (client_id, requested_username, client_username, client_full_name)
    values (v_client.id, v_username, v_client.username, v_client.full_name)
    on conflict (client_id) where status = 'pending' and client_id is not null do nothing;
  end if;

  return 'accepted';
end;
$$;

revoke execute on function public.request_password_reset(text, text) from public;
grant execute on function public.request_password_reset(text, text) to service_role;

create or replace function public.admin_complete_password_reset(p_request_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_request public.password_reset_requests%rowtype;
begin
  if not (select private.is_admin()) then raise exception 'Não autorizado.'; end if;
  select * into v_request from public.password_reset_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Pedido pendente não encontrado.'; end if;

  update public.password_reset_requests
  set status = 'attended', handled_by = (select auth.uid()), handled_at = now(), result = 'password_reset'
  where id = p_request_id;

  insert into public.admin_audit_log (action, client_id, client_username, client_full_name, actor_id, detail)
  values ('password_reset', v_request.client_id, v_request.client_username, v_request.client_full_name,
          (select auth.uid()), jsonb_build_object('request_id', p_request_id));
end;
$$;

create or replace function public.admin_close_password_reset(p_request_id bigint, p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not (select private.is_admin()) then raise exception 'Não autorizado.'; end if;
  if length(v_reason) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres.'; end if;

  update public.password_reset_requests
  set status = 'closed', handled_by = (select auth.uid()), handled_at = now(),
      result = 'closed_without_reset', resolution_reason = v_reason
  where id = p_request_id and status = 'pending';
  if not found then raise exception 'Pedido pendente não encontrado.'; end if;
end;
$$;

revoke execute on function public.admin_complete_password_reset(bigint) from public;
revoke execute on function public.admin_close_password_reset(bigint, text) from public;
grant execute on function public.admin_complete_password_reset(bigint) to authenticated;
grant execute on function public.admin_close_password_reset(bigint, text) to authenticated;
