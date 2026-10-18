-- Endurece o limite público, a retenção e o atendimento concorrente dos
-- pedidos de redefinição. Os eventos são efêmeros; apagar os existentes evita
-- manter usernames em texto e reinicia somente a janela de quota de uma hora.
revoke execute on function public.request_password_reset(text, text) from public;
drop function public.request_password_reset(text, text);

truncate table private.password_reset_attempts;
drop index private.password_reset_attempts_username_created_idx;
alter table private.password_reset_attempts drop column username;
alter table private.password_reset_attempts
  add column username_hash text not null check (length(username_hash) = 64);
create index password_reset_attempts_username_hash_created_idx
  on private.password_reset_attempts (username_hash, created_at desc);

create or replace function private.purge_password_reset_attempts()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.password_reset_attempts
  where created_at < now() - interval '24 hours';
$$;

revoke execute on function private.purge_password_reset_attempts() from public;

-- Supabase Cron usa pg_cron. O bloco dinâmico permite que a migration seja
-- exercitada em Postgres sem a extensão, mas agenda o expurgo quando disponível.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute 'select cron.unschedule(jobid) from cron.job where jobname = $1'
      using 'purge-password-reset-attempts-hourly';
    execute $job$
      select cron.schedule(
        'purge-password-reset-attempts-hourly',
        '0 * * * *',
        'select private.purge_password_reset_attempts()'
      )
    $job$;
  else
    raise warning 'pg_cron indisponível: configure o expurgo horário antes da produção';
  end if;
end;
$$;

create or replace function public.request_password_reset(
  p_username text,
  p_username_hash text,
  p_source_hash text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_client public.clients%rowtype;
  v_user_lock bigint;
  v_source_lock bigint;
begin
  if length(v_username) < 1 or length(v_username) > 64
     or p_username_hash !~ '^[0-9a-f]{64}$'
     or p_source_hash !~ '^[0-9a-f]{64}$' then
    return 'accepted';
  end if;

  v_user_lock := hashtextextended('password-reset-user:' || p_username_hash, 0);
  v_source_lock := hashtextextended('password-reset-source:' || p_source_hash, 0);
  perform pg_advisory_xact_lock(least(v_user_lock, v_source_lock));
  if v_user_lock <> v_source_lock then
    perform pg_advisory_xact_lock(greatest(v_user_lock, v_source_lock));
  end if;

  perform private.purge_password_reset_attempts();

  if (select count(*) from private.password_reset_attempts where source_hash = p_source_hash and created_at > now() - interval '1 hour') >= 10
     or (select count(*) from private.password_reset_attempts where username_hash = p_username_hash and created_at > now() - interval '1 hour') >= 3 then
    return 'rate_limited';
  end if;

  insert into private.password_reset_attempts (username_hash, source_hash)
  values (p_username_hash, p_source_hash);

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

revoke execute on function public.request_password_reset(text, text, text) from public;
grant execute on function public.request_password_reset(text, text, text) to service_role;

alter table public.password_reset_requests
  add column claim_token uuid,
  add column claimed_by uuid references auth.users (id) on delete set null,
  add column claimed_at timestamptz,
  add constraint password_reset_requests_claim_check check (
    (status = 'pending' and (
      (claim_token is null and claimed_by is null and claimed_at is null)
      or (claim_token is not null and claimed_by is not null and claimed_at is not null)
    ))
    or (status <> 'pending' and claim_token is null and claimed_by is null and claimed_at is null)
  );

revoke execute on function public.admin_complete_password_reset(bigint) from public;
drop function public.admin_complete_password_reset(bigint);

create or replace function public.admin_claim_password_reset(p_request_id bigint)
returns table (client_id uuid, claim_token uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare v_token uuid := gen_random_uuid();
begin
  if not (select private.is_admin()) then raise exception 'Não autorizado.'; end if;

  return query
  update public.password_reset_requests as request
  set claim_token = v_token,
      claimed_by = (select auth.uid()),
      claimed_at = now()
  where request.id = p_request_id
    and request.status = 'pending'
    and (request.claim_token is null or request.claimed_at < now() - interval '5 minutes')
  returning request.client_id, request.claim_token;
end;
$$;

create or replace function public.admin_release_password_reset_claim(p_request_id bigint, p_claim_token uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'Não autorizado.'; end if;
  update public.password_reset_requests
  set claim_token = null, claimed_by = null, claimed_at = null
  where id = p_request_id and status = 'pending'
    and claim_token = p_claim_token and claimed_by = (select auth.uid());
end;
$$;

create or replace function public.admin_complete_password_reset(p_request_id bigint, p_claim_token uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_request public.password_reset_requests%rowtype;
begin
  if not (select private.is_admin()) then raise exception 'Não autorizado.'; end if;
  select * into v_request
  from public.password_reset_requests
  where id = p_request_id and status = 'pending'
    and claim_token = p_claim_token and claimed_by = (select auth.uid())
  for update;
  if not found then raise exception 'Reserva do pedido não encontrada.'; end if;

  update public.password_reset_requests
  set status = 'attended', handled_by = (select auth.uid()), handled_at = now(),
      result = 'password_reset', claim_token = null, claimed_by = null, claimed_at = null
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
      result = 'closed_without_reset', resolution_reason = v_reason,
      claim_token = null, claimed_by = null, claimed_at = null
  where id = p_request_id and status = 'pending'
    and (claim_token is null or claimed_at < now() - interval '5 minutes');
  if not found then raise exception 'Pedido pendente não encontrado ou em atendimento.'; end if;
end;
$$;

revoke execute on function public.admin_claim_password_reset(bigint) from public;
revoke execute on function public.admin_release_password_reset_claim(bigint, uuid) from public;
revoke execute on function public.admin_complete_password_reset(bigint, uuid) from public;
revoke execute on function public.admin_close_password_reset(bigint, text) from public;
grant execute on function public.admin_claim_password_reset(bigint) to authenticated;
grant execute on function public.admin_release_password_reset_claim(bigint, uuid) to authenticated;
grant execute on function public.admin_complete_password_reset(bigint, uuid) to authenticated;
grant execute on function public.admin_close_password_reset(bigint, text) to authenticated;
