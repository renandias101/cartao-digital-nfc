-- ============================================================================
-- Corrige `get_public_card`: botões desativados não podem sair da função
-- pública (PRD §11 — "botões desativados não aparecem na página pública").
--
-- A versão anterior (etapa 3) devolvia o array de botões inteiro, deixando a
-- filtragem por conta de quem renderiza a página pública (etapa 9, ainda não
-- construída). Isso contraria o princípio seguido no resto do projeto: nunca
-- confiar só no frontend para uma regra que importa (Seguranca 11-12). Achado
-- na verificação de ponta a ponta desta etapa, antes de a etapa 9 existir —
-- corrigido aqui, na função que já é a fonte única de verdade do que o
-- visitante recebe.
-- ============================================================================
create or replace function public.get_public_card(p_username text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_set(
    cp.content,
    '{buttons}',
    coalesce(
      (
        select jsonb_agg(t.elem order by t.ordinality)
        from jsonb_array_elements(cp.content -> 'buttons') with ordinality as t(elem, ordinality)
        where coalesce((t.elem->>'enabled')::boolean, false)
      ),
      '[]'::jsonb
    )
  )
  from public.card_published cp
  join public.clients c on c.id = cp.client_id
  where c.username = p_username
    and public.effective_status(c.expires_at, c.cancelled_at) = 'active';
$$;
