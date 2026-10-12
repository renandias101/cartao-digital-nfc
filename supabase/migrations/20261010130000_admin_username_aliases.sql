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
