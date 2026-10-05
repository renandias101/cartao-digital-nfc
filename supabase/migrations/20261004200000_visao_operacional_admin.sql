-- ============================================================================
-- Visão operacional do painel administrativo: tudo que a lista e a home
-- precisam numa consulta só (sem N+1).
--
-- Estado do cartão — compara o CONTEÚDO do rascunho com o publicado, não as
-- datas: "Descartar alterações" e o salvamento automático regravam o
-- rascunho (atualizando `updated_at`) sem mudar nada, e a comparação por data
-- acusaria alteração pendente onde não há.
--   never_published  sem linha em card_published
--   pending_changes  rascunho diferente do publicado
--   up_to_date       rascunho igual ao publicado
--
-- `security_invoker`: cada tabela mantém a própria RLS — só o admin enxerga
-- as linhas dos outros clientes.
-- ============================================================================

create or replace view public.admin_client_overview
with (security_invoker = true) as
select
  c.id,
  c.username,
  c.full_name,
  c.package_months,
  c.expires_at,
  c.cancelled_at,
  c.last_renewed_at,
  c.created_at,
  public.effective_status(c.expires_at, c.cancelled_at) as status,
  ceil(extract(epoch from (c.expires_at - now())) / 86400)::integer as days_until_expiry,
  public.client_cancelled_on(c.expires_at, c.cancelled_at) as cancelled_on,
  public.client_deletion_eligible_at(c.expires_at, c.cancelled_at) as deletion_eligible_at,
  d.updated_at as draft_updated_at,
  p.published_at,
  case
    when p.client_id is null then 'never_published'
    when d.content is distinct from p.content then 'pending_changes'
    else 'up_to_date'
  end as card_state,
  coalesce(s.open_count, 0)::integer as open_support_count
from public.clients c
left join public.card_drafts d on d.client_id = c.id
left join public.card_published p on p.client_id = c.id
left join (
  select client_id, count(*) as open_count
  from public.support_requests
  where status = 'open'
  group by client_id
) s on s.client_id = c.id;

revoke all on public.admin_client_overview from anon, authenticated;
grant select on public.admin_client_overview to authenticated;

-- ---------------------------------------------------------------------------
-- Lista paginada com filtros. Filtros de estado do cartão olham só clientes
-- não cancelados: cartão cancelado está fora do ar e não pede ação.
-- Busca: nome, usuário e os contatos administrativos (WhatsApp por dígitos,
-- e-mail). `%` e `_` digitados são texto, não curinga.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_clients(
  p_filter text default 'todos',
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
  cancelled_on timestamptz,
  deletion_eligible_at timestamptz,
  draft_updated_at timestamptz,
  published_at timestamptz,
  card_state text,
  open_support_count integer,
  total_count bigint
)
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
  select
    o.id, o.username, o.full_name, o.package_months, o.expires_at, o.cancelled_at, o.last_renewed_at,
    o.created_at, o.status, o.days_until_expiry, o.cancelled_on, o.deletion_eligible_at,
    o.draft_updated_at, o.published_at, o.card_state, o.open_support_count,
    count(*) over() as total_count
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
      t.bruto is null
      or o.username ilike t.padrao
      or o.full_name ilike t.padrao
      or ct.email ilike t.padrao
      or (t.digitos is not null and length(t.digitos) >= 4 and ct.whatsapp like '%' || t.digitos || '%')
    )
  order by o.created_at desc
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$$;

revoke execute on function public.admin_list_clients(text, text, integer, integer) from public;
grant execute on function public.admin_list_clients(text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- "O que precisa da minha atenção hoje?" — uma linha com todas as contagens,
-- nos mesmos critérios dos filtros acima.
-- ---------------------------------------------------------------------------
create or replace function public.admin_attention_counts()
returns table (
  ativos bigint,
  vence_em_15_dias bigint,
  vencidos bigint,
  cancelados bigint,
  alteracoes_nao_publicadas bigint,
  nunca_publicados bigint,
  elegiveis_exclusao bigint,
  suporte_aberto bigint
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'active' and days_until_expiry <= 15),
    count(*) filter (where status = 'expired'),
    count(*) filter (where status = 'cancelled'),
    count(*) filter (where status <> 'cancelled' and card_state = 'pending_changes'),
    count(*) filter (where status <> 'cancelled' and card_state = 'never_published'),
    count(*) filter (where deletion_eligible_at <= now()),
    (select count(*) from public.support_requests where status = 'open')
  from public.admin_client_overview;
$$;

revoke execute on function public.admin_attention_counts() from public;
grant execute on function public.admin_attention_counts() to authenticated;

-- `list_clients_for_admin` (etapa 6) fica sem uso: substituída por
-- `admin_list_clients`. A remoção fica para uma migration à parte, aplicada
-- manualmente (a ferramenta de migrations não aplica DROP sem confirmação).
