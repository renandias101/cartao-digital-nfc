-- ============================================================================
-- Página pública: distinguir "não encontrado" de "não disponível" (PRD §24,
-- §27, §49, §50).
--
-- `get_public_card` (etapa 3) devolve NULL tanto para username inexistente
-- quanto para cliente vencido/cancelado — de propósito, porque o §21 proíbe
-- revelar o STATUS ao visitante. Só que o PRD pede DUAS mensagens diferentes
-- nesses casos ("não foi encontrado" vs. "não está disponível"), o que essa
-- função sozinha não permite distinguir.
--
-- Esta função revela só EXISTÊNCIA — nunca o status — o mínimo necessário
-- para a página escolher a mensagem certa sem violar o §21.
-- ============================================================================
create or replace function public.username_exists(p_username text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.clients where username = lower(p_username)
  );
$$;

revoke execute on function public.username_exists(text) from public;
grant execute on function public.username_exists(text) to anon, authenticated;
