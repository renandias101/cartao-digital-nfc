-- Execução manual no Supabase SQL Editor — 12/10/2026
-- Execute somente após backup. As cinco migrations rodam em uma transação.
begin;

-- ============================================================================
-- 20261010120000_admin_consistency_and_pagination.sql
-- ============================================================================
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


-- ============================================================================
-- 20261010130000_admin_username_aliases.sql
-- ============================================================================
-- Alteracao administrativa do nome de usuario e aliases permanentes.
-- A operacao inteira (alias, cliente e auditoria) ocorre na mesma transacao.

create table public.client_username_aliases (
  alias text primary key,
  client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint client_username_aliases_formato check (
    alias ~ '^[a-z0-9]([a-z0-9]|-[a-z0-9])*$' and length(alias) between 3 and 32
  )
);

create index client_username_aliases_client_id_idx
  on public.client_username_aliases (client_id)
  where client_id is not null;

alter table public.client_username_aliases enable row level security;
alter table public.client_username_aliases force row level security;
revoke all on public.client_username_aliases from anon, authenticated;

alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action in (
  'client_created', 'password_reset', 'renewed', 'cancelled', 'deleted', 'notes_updated', 'client_updated',
  'contacts_updated', 'card_draft_saved', 'card_published', 'card_draft_discarded', 'payment_recorded',
  'username_changed'
));

-- Serializa qualquer tentativa de ocupar o mesmo endereco e impede que um
-- alias historico volte a ser usado, inclusive numa criacao concorrente.
create or replace function public.guard_reserved_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.username, 0));
  if exists (select 1 from public.reserved_usernames where username = new.username)
     or exists (select 1 from public.client_username_aliases where alias = new.username) then
    raise exception 'Nome de usuario reservado: %', new.username
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.admin_change_client_username(
  p_client_id uuid,
  p_new_username text
)
returns table (previous_username text, new_username text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.clients%rowtype;
  v_new text := lower(btrim(p_new_username));
begin
  if not private.is_admin() then
    raise exception 'Nao autorizado.' using errcode = 'insufficient_privilege';
  end if;
  if p_new_username is null or p_new_username <> v_new
     or v_new !~ '^[a-z0-9]([a-z0-9]|-[a-z0-9])*$'
     or length(v_new) not between 3 and 32 then
    raise exception 'Nome de usuario invalido.' using errcode = 'check_violation';
  end if;

  select * into v_client from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente nao encontrado.' using errcode = 'no_data_found';
  end if;
  if v_client.username = v_new then
    raise exception 'O novo nome deve ser diferente do atual.' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_new, 0));
  if exists (select 1 from public.clients where username = v_new)
     or exists (select 1 from public.client_username_aliases where alias = v_new)
     or exists (select 1 from public.reserved_usernames where username = v_new)
     or exists (select 1 from private.admins where lower(username) = v_new) then
    raise exception 'Nome de usuario indisponivel.' using errcode = 'unique_violation';
  end if;

  insert into public.client_username_aliases (alias, client_id)
  values (v_client.username, v_client.id);

  update public.clients set username = v_new where id = v_client.id;

  insert into public.admin_audit_log
    (action, client_id, client_username, client_full_name, actor_id, detail)
  values
    ('username_changed', v_client.id, v_new, v_client.full_name, (select auth.uid()),
     jsonb_build_object('previous_username', v_client.username, 'new_username', v_new));

  return query select v_client.username, v_new;
end;
$$;

revoke execute on function public.admin_change_client_username(uuid, text) from public;
grant execute on function public.admin_change_client_username(uuid, text) to authenticated;

-- O endereco atual e qualquer alias chegam ao mesmo conteudo publicado. O
-- status efetivo continua sendo conferido antes de devolver qualquer dado.
create or replace function public.get_public_card(p_username text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with resolved as (
    select c.id from public.clients c where c.username = lower(p_username)
    union all
    select a.client_id from public.client_username_aliases a
    where a.alias = lower(p_username) and a.client_id is not null
    limit 1
  )
  select jsonb_set(
    cp.content, '{buttons}',
    coalesce((select jsonb_agg(t.elem order by t.ordinality)
      from jsonb_array_elements(cp.content -> 'buttons') with ordinality as t(elem, ordinality)
      where coalesce((t.elem->>'enabled')::boolean, false)), '[]'::jsonb)
  )
  from resolved r
  join public.clients c on c.id = r.id
  join public.card_published cp on cp.client_id = c.id
  where public.effective_status(c.expires_at, c.cancelled_at) = 'active';
$$;

create or replace function public.username_exists(p_username text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.clients where username = lower(p_username))
    or exists (select 1 from public.client_username_aliases where alias = lower(p_username))
    or exists (select 1 from public.reserved_usernames
               where username = lower(p_username) and reason = 'deleted_client');
$$;

-- O nome atual localiza a conta, mas a credencial permanece ligada ao e-mail
-- real de auth.users. Aliases antigos nao autenticam.
create or replace function public.resolve_login_identity(p_username text)
returns table (user_id uuid, email text)
language sql
security invoker
set search_path = ''
stable
as $$
  select c.id, u.email
  from public.clients c join auth.users u on u.id = c.id
  where lower(c.username) = lower(p_username)
  union all
  select a.user_id, u.email
  from private.admins a join auth.users u on u.id = a.user_id
  where lower(a.username) = lower(p_username)
  limit 1;
$$;

grant select on auth.users to service_role;
revoke execute on function public.resolve_login_identity(text) from public;
grant execute on function public.resolve_login_identity(text) to service_role;


-- ============================================================================
-- 20261010140000_payment_on_client_creation.sql
-- ============================================================================
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


-- ============================================================================
-- 20261010150000_runtime_validation_and_support_quota.sql
-- ============================================================================
-- Validação estrita de JSON e quota de suporte atômica.
create or replace function public.validate_card_content(content jsonb, require_complete boolean default false)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content->'buttons') = 'array'
    and jsonb_array_length(content->'buttons') <= 10
    and public.validate_all_buttons(content->'buttons')
    and (content->'displayName' is null or (jsonb_typeof(content->'displayName') = 'string' and length(content->>'displayName') between 1 and 60))
    and (not require_complete or (jsonb_typeof(content->'displayName') = 'string' and length(content->>'displayName') between 1 and 60))
    and (content->'profession' is null or (jsonb_typeof(content->'profession') = 'string' and length(content->>'profession') <= 60))
    and (content->'professionColor' is null or (jsonb_typeof(content->'professionColor') = 'string' and content->>'professionColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (content->'accentColor' is null or (jsonb_typeof(content->'accentColor') = 'string' and content->>'accentColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (content->'contactPhone' is null or (jsonb_typeof(content->'contactPhone') = 'string' and content->>'contactPhone' ~ '^[0-9+() .-]{0,30}$'))
    and (content->'description' is null or (jsonb_typeof(content->'description') = 'string' and length(content->>'description') <= 250))
    and (content->'backgroundColor' is null or (jsonb_typeof(content->'backgroundColor') = 'string' and content->>'backgroundColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (not require_complete or (jsonb_typeof(content->'backgroundColor') = 'string' and content->>'backgroundColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (content->'buttonColor' is null or (jsonb_typeof(content->'buttonColor') = 'string' and content->>'buttonColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (not require_complete or (jsonb_typeof(content->'buttonColor') = 'string' and content->>'buttonColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (content->'profilePhoto' is null or jsonb_typeof(content->'profilePhoto') = 'string')
    and (content->'banner' is null or jsonb_typeof(content->'banner') = 'string')
    and (content->'backgroundImage' is null or jsonb_typeof(content->'backgroundImage') = 'string'), false);
$$;

create or replace function private.enforce_support_request_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() then return new; end if;
  if new.client_id <> auth.uid() then raise exception 'Nao autorizado.' using errcode = 'insufficient_privilege'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.client_id::text, 1));
  new.created_at := now();
  if (select count(*) from public.support_requests where client_id = new.client_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Limite de pedidos de suporte atingido.' using errcode = 'program_limit_exceeded';
  end if;
  return new;
end;
$$;

create trigger support_requests_enforce_quota
  before insert on public.support_requests
  for each row execute function private.enforce_support_request_quota();

alter policy support_requests_insert_own on public.support_requests
  with check (
    client_id = (select auth.uid()) and status = 'open' and resolved_at is null
    and category is null and priority = 'normal' and admin_note is null
  );


-- ============================================================================
-- 20261010160000_private_card_images.sql
-- ============================================================================
-- Imagens ficam privadas. Escrita normal ocorre apenas por URLs de upload
-- assinadas pelo servidor; leitura passa por /api/card-image e esta função.
drop policy if exists card_images_insert_own on storage.objects;
drop policy if exists card_images_select_own on storage.objects;
drop policy if exists card_images_update_own on storage.objects;
drop policy if exists card_images_delete_own on storage.objects;
drop policy if exists card_images_admin_all on storage.objects;

update storage.buckets
set public = false, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'card-images';

create or replace function public.can_read_card_image(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_path !~ '^[0-9a-fA-F-]{36}/(profile|banner|background|icon)-[0-9a-fA-F-]{36}[.]webp$' then false
    when (select auth.uid()) is not null and (
      split_part(p_path, '/', 1) = (select auth.uid())::text or private.is_admin()
    ) then true
    else exists (
      select 1
      from public.card_published cp
      join public.clients c on c.id = cp.client_id
      where c.id::text = split_part(p_path, '/', 1)
        and public.effective_status(c.expires_at, c.cancelled_at) = 'active'
        and (
          cp.content->>'profilePhoto' = '/api/card-image?path=' || p_path
          or cp.content->>'banner' = '/api/card-image?path=' || p_path
          or cp.content->>'backgroundImage' = '/api/card-image?path=' || p_path
          or exists (select 1 from jsonb_array_elements(coalesce(cp.content->'buttons', '[]'::jsonb)) b where b->>'icon' = '/api/card-image?path=' || p_path)
        )
    )
  end;
$$;
revoke all on function public.can_read_card_image(text) from public;
grant execute on function public.can_read_card_image(text) to anon, authenticated;

create or replace function public.card_image_refs_are_owned(content jsonb, client_id uuid)
returns boolean language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from (
      select content->>'profilePhoto' value union all
      select content->>'banner' union all
      select content->>'backgroundImage'
    ) refs
    where value is not null and value <> ''
      and value !~ ('^/api/card-image[?]path=' || client_id::text || '/(profile|banner|background|icon)-[0-9a-fA-F-]{36}[.]webp$')
  ) and not exists (
    select 1 from jsonb_array_elements(coalesce(content->'buttons', '[]'::jsonb)) b
    where (b->>'icon' like '/api/card-image?path=%' or b->>'icon' ~ '^https?://')
      and b->>'icon' !~ ('^/api/card-image[?]path=' || client_id::text || '/icon-[0-9a-fA-F-]{36}[.]webp$')
  );
$$;

alter table public.card_drafts drop constraint if exists card_drafts_image_ownership;
update public.card_drafts
set content = regexp_replace(
  content::text,
  'https://[^" ]+/storage/v1/object/public/card-images/([^"?]+)',
  '/api/card-image?path=\1', 'g'
)::jsonb
where content::text like '%/storage/v1/object/public/card-images/%';
update public.card_published
set content = regexp_replace(
  content::text,
  'https://[^" ]+/storage/v1/object/public/card-images/([^"?]+)',
  '/api/card-image?path=\1', 'g'
)::jsonb
where content::text like '%/storage/v1/object/public/card-images/%';
alter table public.card_drafts add constraint card_drafts_image_ownership check (public.card_image_refs_are_owned(content, client_id));
alter table public.card_published drop constraint if exists card_published_image_ownership;
alter table public.card_published add constraint card_published_image_ownership check (public.card_image_refs_are_owned(content, client_id));


commit;
