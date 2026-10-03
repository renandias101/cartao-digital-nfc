-- ============================================================================
-- Painel administrativo — view de leitura
--
-- `clients_with_status` enriquece `clients` com o status derivado e os dias
-- até o vencimento, como colunas comuns — para que a listagem, os filtros
-- (PRD §36) e a busca (PRD §37) usem a API de consulta normal do Supabase,
-- em vez de expressões cruas que o construtor de consultas não expressa bem.
--
-- `security_invoker = true` é obrigatório (Postgres 15+): sem isso, a view
-- roda com o privilégio de quem a criou, ignorando o RLS de `clients` por
-- completo — o oposto do que se quer aqui. Com invoker, herda exatamente as
-- mesmas políticas da tabela: cliente vê só a própria linha, admin vê todas.
-- ============================================================================
create or replace view public.clients_with_status
with (security_invoker = true) as
select
  c.*,
  public.effective_status(c.expires_at, c.cancelled_at) as status,
  ceil(extract(epoch from (c.expires_at - now())) / 86400)::integer as days_until_expiry
from public.clients c;

grant select on public.clients_with_status to authenticated;

-- ---------------------------------------------------------------------------
-- Listagem paginada, filtrada e pesquisável (PRD §36, §37, §38).
--
-- Parâmetros ligados de verdade (`p_term`), não uma string de filtro montada
-- por concatenação — o DSL de `.or()` do PostgREST exige escapar valor com
-- caractere especial envolvendo-o em aspas duplas, e uma implementação
-- errada disso deixaria um termo de busca alterar a estrutura do filtro, não
-- só o valor buscado. Uma função com parâmetro evita esse problema por
-- completo: aqui, é sempre um valor, nunca uma sintaxe.
--
-- `count(*) over()` traz o total de linhas (antes da paginação) junto com
-- cada página, numa única consulta — evita uma segunda ida ao banco só para
-- contar.
-- ---------------------------------------------------------------------------
create or replace function public.list_clients_for_admin(
  p_status text default null,
  p_max_days integer default null,
  p_term text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  full_name text,
  package_months smallint,
  expires_at timestamptz,
  cancelled_at timestamptz,
  last_renewed_at timestamptz,
  created_at timestamptz,
  status text,
  days_until_expiry integer,
  total_count bigint
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    c.id, c.username, c.full_name, c.package_months, c.expires_at, c.cancelled_at,
    c.last_renewed_at, c.created_at, c.status, c.days_until_expiry,
    count(*) over() as total_count
  from public.clients_with_status c
  where (p_status is null or c.status = p_status)
    and (p_max_days is null or c.days_until_expiry <= p_max_days)
    and (
      p_term is null or p_term = '' or
      c.username ilike '%' || p_term || '%' or
      c.full_name ilike '%' || p_term || '%'
    )
  order by c.created_at desc
  limit p_limit offset p_offset;
$$;

revoke execute on function public.list_clients_for_admin(text, integer, text, integer, integer) from public;
grant execute on function public.list_clients_for_admin(text, integer, text, integer, integer) to authenticated;
