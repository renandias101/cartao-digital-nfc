-- ============================================================================
-- Rodapé do sistema nos cartões ("Precisa de uma solução digital?").
--
-- Aparece no fim de todo cartão ativo. O cliente não altera nem remove: o
-- conteúdo NÃO fica no JSON do cartão (que o cliente grava), e sim nesta
-- tabela de uma linha só, que apenas o administrador escreve.
--
-- Acesso, no mesmo modelo do resto do schema:
--   anon/cliente  sem privilégio na tabela. Leem só pela função
--                 `get_card_footer()`, que devolve o rodapé ativo ou nada.
--   admin         lê e altera a linha, via política com `private.is_admin()`.
-- ============================================================================

create table public.card_footer_settings (
  -- Linha única: a chave só aceita `true`.
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  title text not null check (length(title) between 1 and 60),
  subtitle text not null default '' check (length(subtitle) <= 120),
  button_label text not null check (length(button_label) between 1 and 30),
  -- Só http(s) (mesma regra dos botões de link, PRD §46).
  url text not null check (length(url) <= 500 and url ~ '^https?://\S+$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger card_footer_settings_set_updated_at
  before update on public.card_footer_settings
  for each row execute function public.set_updated_at();

insert into public.card_footer_settings (title, subtitle, button_label, url)
values (
  'Precisa de uma solução digital?',
  'Sites, sistemas e cartões digitais para o seu negócio.',
  'Solicitar serviço',
  'https://wa.me/5596981233398'
);

revoke all on public.card_footer_settings from anon, authenticated;
grant select, update on public.card_footer_settings to authenticated;

alter table public.card_footer_settings enable row level security;
alter table public.card_footer_settings force row level security;

create policy card_footer_settings_select_admin on public.card_footer_settings
  for select to authenticated
  using ((select private.is_admin()));

create policy card_footer_settings_update_admin on public.card_footer_settings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Leitura pública: só os campos exibidos, e nada quando desativado.
-- ---------------------------------------------------------------------------
create or replace function public.get_card_footer()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', title,
    'subtitle', subtitle,
    'buttonLabel', button_label,
    'url', url
  )
  from public.card_footer_settings
  where enabled;
$$;

revoke execute on function public.get_card_footer() from public;
grant execute on function public.get_card_footer() to anon, authenticated;
