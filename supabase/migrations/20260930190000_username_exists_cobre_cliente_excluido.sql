-- ============================================================================
-- Corrige `username_exists`: não cobria cliente excluído (PRD §39 vs §40).
--
-- Achado na auditoria de critérios de aceite da etapa 16, relendo o PRD com
-- atenção aos dois casos que a página pública precisa distinguir:
--   §39 — username que NUNCA existiu: 404 de verdade ("Este cartão não foi
--         encontrado.").
--   §40 — username de um cliente EXCLUÍDO: NÃO pode gerar erro do sistema;
--         precisa mostrar a mesma página neutra de vencido/cancelado
--         ("Este cartão não está disponível.").
--
-- `username_exists` (etapa 9) só consultava `public.clients` — depois que
-- `delete_client` remove a linha de lá, a função responde `false` para um
-- username que JÁ FOI de um cliente de verdade, exatamente como responderia
-- para um username nunca usado. A página pública (`src/app/[username]/
-- page.tsx`) usa esse `false` para decidir `notFound()` — ou seja, hoje um
-- cartão excluído cai em 404, contrariando o §40.
--
-- A própria tabela `reserved_usernames` (etapa 3, decisão P2) já registra
-- isso com precisão: toda exclusão grava uma linha com
-- `reason = 'deleted_client'`, e só exclusão grava esse motivo (o outro
-- valor, `'system'`, é só a lista fixa de palavras reservadas, que nunca deve
-- levar à página neutra — continuam sendo 404 se não houver rota própria).
-- Corrigido somando essa segunda checagem.
-- ============================================================================
create or replace function public.username_exists(p_username text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    exists (
      select 1 from public.clients where username = lower(p_username)
    )
    or exists (
      select 1 from public.reserved_usernames
      where username = lower(p_username) and reason = 'deleted_client'
    );
$$;
