-- ============================================================================
-- Schema inicial — Plataforma de Cartão Digital com NFC
--
-- Princípios aplicados:
--  * Isolamento no banco (PRD §42): RLS em toda tabela exposta, sempre com
--    predicado de propriedade. `TO authenticated` sozinho seria autenticação
--    sem autorização.
--  * O visitante nunca vê status interno (PRD §21, §24, §27): o papel `anon`
--    não recebe privilégio em nenhuma tabela. O acesso público acontece por
--    uma única função, que devolve o cartão publicado ou nada.
--  * Status derivado, não armazenado: o bloqueio do §23 é instantâneo e não
--    depende de job. Ver `public.effective_status`.
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Administradores
--
-- Fica em `private` para não ser alcançável pela API de dados. A identificação
-- de administrador nunca usa `user_metadata`, que é editável pelo próprio
-- usuário e portanto inseguro para autorização.
-- ---------------------------------------------------------------------------
create table private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from private.admins
    where user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Nomes de usuário reservados (PRD §6)
--
-- O banco é a autoridade. Inclui os exemplos do PRD, as rotas previstas e os
-- caminhos reservados pela plataforma. Slugs de clientes excluídos entram aqui
-- com motivo 'deleted_client', para que um cartão NFC antigo em circulação
-- nunca passe a abrir o cartão de outra pessoa.
-- ---------------------------------------------------------------------------
create table public.reserved_usernames (
  username text primary key,
  reason text not null check (reason in ('system', 'deleted_client')),
  created_at timestamptz not null default now()
);

insert into public.reserved_usernames (username, reason) values
  ('admin', 'system'), ('login', 'system'), ('painel', 'system'),
  ('api', 'system'), ('sistema', 'system'), ('suporte', 'system'),
  ('logout', 'system'), ('sair', 'system'), ('conta', 'system'),
  ('cartao', 'system'), ('cartoes', 'system'), ('editor', 'system'),
  ('configuracoes', 'system'), ('renovar', 'system'),
  ('_next', 'system'), ('_vercel', 'system'), ('static', 'system'),
  ('public', 'system'), ('assets', 'system'), ('favicon.ico', 'system'),
  ('robots.txt', 'system'), ('sitemap.xml', 'system'),
  ('manifest.json', 'system'), ('opengraph-image', 'system'),
  ('apple-touch-icon.png', 'system'), ('app', 'system'), ('auth', 'system'),
  ('dashboard', 'system'), ('root', 'system'), ('null', 'system'),
  ('undefined', 'system'), ('sobre', 'system'), ('contato', 'system'),
  ('termos', 'system'), ('privacidade', 'system'), ('ajuda', 'system'),
  ('novo', 'system'), ('editar', 'system'), ('teste', 'system');

-- ---------------------------------------------------------------------------
-- Clientes
--
-- `id` é o próprio id do usuário no Supabase Auth: uma conta, um cliente, um
-- cartão (PRD §7).
--
-- Não existe coluna `status`. O status é derivado de `expires_at` e
-- `cancelled_at`, então não há estado armazenado capaz de divergir da
-- realidade nem janela em que um cartão vencido continue no ar.
--
-- Campos deliberadamente ausentes: telefone e e-mail de contato. O PRD não os
-- pede e a LGPD manda coletar apenas o necessário. Acrescentar depois é uma
-- coluna anulável.
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  package_months smallint not null check (package_months in (3, 6, 12)),
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  last_renewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_username_formato check (
    username ~ '^[a-z0-9]([a-z0-9]|-[a-z0-9])*$' and length(username) between 3 and 32
  )
);

create index clients_expires_at_idx on public.clients (expires_at);
create index clients_cancelled_at_idx on public.clients (cancelled_at)
  where cancelled_at is not null;

-- ---------------------------------------------------------------------------
-- Status derivado (PRD §21 a §27)
--
-- Precedência:
--  1. cancelamento manual pelo administrador;
--  2. 15 dias corridos após o vencimento, cancelado automaticamente (§26);
--  3. depois do vencimento, vencido (§23);
--  4. caso contrário, ativo.
-- ---------------------------------------------------------------------------
create or replace function public.effective_status(
  p_expires_at timestamptz,
  p_cancelled_at timestamptz
)
returns text
language sql
stable
parallel safe
as $$
  select case
    when p_cancelled_at is not null then 'cancelled'
    when now() > p_expires_at + interval '15 days' then 'cancelled'
    when now() > p_expires_at then 'expired'
    else 'active'
  end;
$$;

grant execute on function public.effective_status(timestamptz, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Cartão: rascunho e versão publicada em tabelas separadas
--
-- Duas tabelas em vez de duas colunas na mesma linha é decisão de segurança.
-- RLS filtra linhas, não colunas: se o rascunho morasse na mesma linha da
-- versão publicada, qualquer papel autorizado a ler a linha leria também o
-- rascunho, violando o §17.
-- ---------------------------------------------------------------------------
create table public.card_drafts (
  client_id uuid primary key references public.clients (id) on delete cascade,
  content jsonb not null default '{"buttons": []}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint card_drafts_content_objeto check (jsonb_typeof(content) = 'object'),
  constraint card_drafts_botoes_array check (
    jsonb_typeof(content -> 'buttons') = 'array'
  ),
  constraint card_drafts_max_botoes check (
    jsonb_array_length(content -> 'buttons') <= 10
  ),
  constraint card_drafts_tamanho check (pg_column_size(content) <= 65536)
);

create table public.card_published (
  client_id uuid primary key references public.clients (id) on delete cascade,
  content jsonb not null,
  published_at timestamptz not null default now(),
  constraint card_published_content_objeto check (jsonb_typeof(content) = 'object'),
  constraint card_published_botoes_array check (
    jsonb_typeof(content -> 'buttons') = 'array'
  ),
  constraint card_published_max_botoes check (
    jsonb_array_length(content -> 'buttons') <= 10
  ),
  constraint card_published_tamanho check (pg_column_size(content) <= 65536)
);

-- ---------------------------------------------------------------------------
-- Observações internas do administrador (PRD §39)
--
-- Tabela separada de `clients` pelo mesmo motivo de isolamento de coluna: o
-- cliente lê a própria linha em `clients`, então uma coluna de observação ali
-- ficaria visível para ele.
-- ---------------------------------------------------------------------------
create table public.client_notes (
  client_id uuid primary key references public.clients (id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Histórico administrativo (PRD §40)
--
-- `client_id` usa ON DELETE SET NULL e os campos de snapshot preservam quem era
-- o cliente: o registro da exclusão precisa sobreviver à exclusão da conta,
-- senão o §40 e o §34 se contradizem.
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  action text not null check (action in (
    'client_created', 'password_reset', 'renewed', 'cancelled',
    'deleted', 'notes_updated', 'client_updated'
  )),
  client_id uuid references public.clients (id) on delete set null,
  client_username text not null,
  client_full_name text,
  actor_id uuid references auth.users (id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_client_id_idx on public.admin_audit_log (client_id);
create index admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger client_notes_set_updated_at
  before update on public.client_notes
  for each row execute function public.set_updated_at();

create trigger card_drafts_set_updated_at
  before update on public.card_drafts
  for each row execute function public.set_updated_at();

-- Impede que um nome reservado seja usado como nome de usuário (PRD §6).
create or replace function public.guard_reserved_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.reserved_usernames where username = new.username
  ) then
    raise exception 'Nome de usuario reservado: %', new.username
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger clients_guard_reserved_username
  before insert or update of username on public.clients
  for each row execute function public.guard_reserved_username();

-- Ao excluir um cliente, o slug fica reservado para sempre (decisão P2).
create or replace function public.reserve_username_on_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.reserved_usernames (username, reason)
  values (old.username, 'deleted_client')
  on conflict (username) do nothing;
  return old;
end;
$$;

create trigger clients_reserve_username_on_delete
  after delete on public.clients
  for each row execute function public.reserve_username_on_delete();
