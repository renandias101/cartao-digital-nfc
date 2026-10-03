-- ============================================================================
-- Shim mínimo da superfície do Supabase, para rodar as migrations num Postgres
-- local (PGlite) sem depender de Docker nem de um projeto na nuvem.
--
-- Emula apenas o que as migrations usam: os papéis, a tabela `auth.users` e a
-- função `auth.uid()`. A implementação de `auth.uid()` segue a do Supabase,
-- lendo o `sub` das claims do JWT a partir de uma variável de sessão.
--
-- Não substitui a validação final contra o projeto real: o Supabase tem mais
-- gatilhos, extensões e configurações do que isto. Serve para provar a lógica
-- das políticas de RLS, que é o ponto mais crítico do projeto (PRD §42).
-- ============================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key,
  email text unique
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
