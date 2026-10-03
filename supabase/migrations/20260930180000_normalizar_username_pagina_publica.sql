-- ============================================================================
-- Corrige inconsistência de maiúsculas/minúsculas na página pública (PRD §62).
--
-- Achado na auditoria de segurança/isolamento da etapa 15: `username` só é
-- gravado em minúsculas (CHECK constraint em `clients` + normalização em
-- `criarCliente`), e `username_exists` já compara com `lower(p_username)` —
-- mas `get_public_card` (etapa 3) comparava sem normalizar. Resultado: uma
-- URL com alguma letra maiúscula (autocapitalização do teclado do celular,
-- barra de endereço, um QR/NFC gravado com case diferente) faz
-- `username_exists` responder "existe" enquanto `get_public_card` não
-- encontra a linha — a página mostra "Cartão indisponível" para um cliente
-- de verdade ATIVO. Não é falha de RLS nem vazamento de dado (o efeito é o
-- oposto: esconder um cartão que deveria aparecer), mas quebra o caso de uso
-- central do produto (o NFC abre a URL como foi gravada). Corrigido
-- normalizando com `lower()`, igual ao `username_exists`.
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
  where c.username = lower(p_username)
    and public.effective_status(c.expires_at, c.cancelled_at) = 'active';
$$;
