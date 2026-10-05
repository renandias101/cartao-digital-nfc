-- ============================================================================
-- Suporte: o cliente reporta um erro ou pede ajuda pelo balão do editor; o
-- administrador lê e marca como resolvido em /admin/suporte.
--
-- Acesso:
--   cliente  só INSERE, e só em nome próprio (`client_id = auth.uid()`,
--            nunca o id que viria do navegador). Não lê nem altera.
--   admin    lê e altera o status, via política com `private.is_admin()`.
--   anon     nada.
-- ============================================================================

create table public.support_requests (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('error', 'help')),
  -- Erro: o que o cliente tentava fazer. Ajuda: o que ele quer.
  message text not null check (length(btrim(message)) between 1 and 1000),
  -- Só no erro: qual erro apareceu.
  error_text text check (error_text is null or length(btrim(error_text)) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((kind = 'error') = (error_text is not null)),
  check ((status = 'resolved') = (resolved_at is not null))
);

create index support_requests_status_created_idx
  on public.support_requests (status, created_at desc);
create index support_requests_client_id_idx on public.support_requests (client_id);

-- ---------------------------------------------------------------------------
-- Limite de envios: protege contra clique repetido e excesso. Conta com
-- `security definer` porque o cliente não lê a tabela (a política de insert
-- não enxergaria as próprias linhas).
-- ---------------------------------------------------------------------------
create or replace function private.support_requests_last_hour(p_client_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.support_requests
  where client_id = p_client_id
    and created_at > now() - interval '1 hour';
$$;

revoke execute on function private.support_requests_last_hour(uuid) from public;
grant execute on function private.support_requests_last_hour(uuid) to authenticated;

revoke all on public.support_requests from anon, authenticated;
grant insert on public.support_requests to authenticated;
grant select, update on public.support_requests to authenticated;

alter table public.support_requests enable row level security;
alter table public.support_requests force row level security;

create policy support_requests_insert_own on public.support_requests
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and status = 'open'
    and resolved_at is null
    and private.support_requests_last_hour((select auth.uid())) < 5
  );

create policy support_requests_select_admin on public.support_requests
  for select to authenticated
  using ((select private.is_admin()));

create policy support_requests_update_admin on public.support_requests
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
