-- Correções de consistência do painel administrativo (10/10/2026).
-- Todas as funções usam a sessão autenticada e preservam RLS/isolamento.

create or replace function public.admin_update_client_data(
  p_client_id uuid,
  p_full_name text,
  p_whatsapp text,
  p_email text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(p_full_name);
  v_email text := nullif(lower(btrim(p_email)), '');
  v_whatsapp text := nullif(p_whatsapp, '');
  v_username text;
begin
  if not (select private.is_admin()) then raise exception 'Não autorizado.'; end if;
  if length(v_name) not between 2 and 120 then raise exception 'Nome inválido.'; end if;
  if v_whatsapp is not null and v_whatsapp !~ '^[0-9]{10,15}$' then raise exception 'WhatsApp inválido.'; end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'E-mail inválido.';
  end if;

  update public.clients set full_name = v_name where id = p_client_id returning username into v_username;
  if not found then raise exception 'Cliente não encontrado.'; end if;

  insert into public.client_admin_contacts (client_id, whatsapp, email)
  values (p_client_id, v_whatsapp, v_email)
  on conflict (client_id) do update set whatsapp = excluded.whatsapp, email = excluded.email;

  insert into public.admin_audit_log
    (action, client_id, client_username, client_full_name, actor_id, detail)
  values
    ('client_updated', p_client_id, v_username, v_name, (select auth.uid()),
     '{"campos":["full_name","contacts"]}'::jsonb);
end;
$$;

revoke execute on function public.admin_update_client_data(uuid, text, text, text) from public;
grant execute on function public.admin_update_client_data(uuid, text, text, text) to authenticated;

create or replace function public.admin_save_client_notes(p_client_id uuid, p_notes text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_username text;
  v_name text;
begin
  if not (select private.is_admin()) then raise exception 'Não autorizado.'; end if;
  if length(p_notes) > 2000 then raise exception 'Observações muito longas.'; end if;
  select username, full_name into v_username, v_name from public.clients where id = p_client_id;
  if not found then raise exception 'Cliente não encontrado.'; end if;

  insert into public.client_notes (client_id, notes) values (p_client_id, p_notes)
  on conflict (client_id) do update set notes = excluded.notes;
  insert into public.admin_audit_log
    (action, client_id, client_username, client_full_name, actor_id)
  values ('notes_updated', p_client_id, v_username, v_name, (select auth.uid()));
end;
$$;

revoke execute on function public.admin_save_client_notes(uuid, text) from public;
grant execute on function public.admin_save_client_notes(uuid, text) to authenticated;

-- Contagem separada: continua disponível quando o offset da página não retorna linhas.
create or replace function public.admin_count_clients(p_filter text default 'todos', p_term text default null)
returns bigint
language sql
security invoker
set search_path = ''
stable
as $$
  with termo as (
    select
      nullif(btrim(p_term), '') as bruto,
      '%' || replace(replace(replace(btrim(coalesce(p_term, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as padrao,
      nullif(regexp_replace(coalesce(p_term, ''), '\D', '', 'g'), '') as digitos
  )
  select count(*)
  from public.admin_client_overview o
  cross join termo t
  left join public.client_admin_contacts ct on ct.client_id = o.id
  where
    case coalesce(p_filter, 'todos')
      when 'ativos' then o.status = 'active'
      when 'vence_em_15_dias' then o.status = 'active' and o.days_until_expiry <= 15
      when 'vencidos' then o.status = 'expired'
      when 'cancelados' then o.status = 'cancelled'
      when 'atualizados' then o.status <> 'cancelled' and o.card_state = 'up_to_date'
      when 'alteracoes_nao_publicadas' then o.status <> 'cancelled' and o.card_state = 'pending_changes'
      when 'nunca_publicados' then o.status <> 'cancelled' and o.card_state = 'never_published'
      when 'elegiveis_exclusao' then o.deletion_eligible_at <= now()
      when 'suporte_aberto' then o.open_support_count > 0
      else true
    end
    and (
      t.bruto is null or o.username ilike t.padrao or o.full_name ilike t.padrao or ct.email ilike t.padrao
      or (t.digitos is not null and length(t.digitos) >= 4 and ct.whatsapp like '%' || t.digitos || '%')
    );
$$;

revoke execute on function public.admin_count_clients(text, text) from public;
grant execute on function public.admin_count_clients(text, text) to authenticated;

create or replace function public.admin_log_password_reset(p_client_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_username text; v_name text;
begin
  if not (select private.is_admin()) then raise exception 'Não autorizado.'; end if;
  select username, full_name into v_username, v_name from public.clients where id = p_client_id;
  if not found then raise exception 'Cliente não encontrado.'; end if;
  insert into public.admin_audit_log (action, client_id, client_username, client_full_name, actor_id)
  values ('password_reset', p_client_id, v_username, v_name, (select auth.uid()));
end;
$$;

revoke execute on function public.admin_log_password_reset(uuid) from public;
grant execute on function public.admin_log_password_reset(uuid) to authenticated;

-- Parte relacional da criação fica atômica. A conta do Auth é criada antes e
-- removida pelo servidor se esta transação falhar.
create or replace function public.admin_create_client_record(
  p_client_id uuid,
  p_username text,
  p_full_name text,
  p_package_months integer,
  p_expires_at timestamptz,
  p_content jsonb,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.admins where user_id = p_actor_id) then
    raise exception 'Não autorizado.';
  end if;
  insert into public.clients (id, username, full_name, package_months, expires_at)
  values (p_client_id, p_username, p_full_name, p_package_months, p_expires_at);
  insert into public.card_drafts (client_id, content) values (p_client_id, p_content);
  insert into public.admin_audit_log
    (action, client_id, client_username, client_full_name, actor_id, detail)
  values
    ('client_created', p_client_id, p_username, p_full_name, p_actor_id,
     jsonb_build_object('package_months', p_package_months, 'expires_at', p_expires_at));
end;
$$;

revoke execute on function public.admin_create_client_record(uuid, text, text, integer, timestamptz, jsonb, uuid) from public;
grant execute on function public.admin_create_client_record(uuid, text, text, integer, timestamptz, jsonb, uuid) to service_role;
