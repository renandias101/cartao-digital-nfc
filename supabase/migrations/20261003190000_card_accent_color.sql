-- Campo opcional no JSON existente. Sem atualizar dados, tabelas ou RLS.
-- O rascunho pode ser gravado direto pelo cliente: a cor de destaque vai
-- para o `style` do cartão, então só hexadecimal é aceito (mesma regra da
-- cor da profissão).
create or replace function public.validate_card_accent_color(content jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    not (content ? 'accentColor') or (
      jsonb_typeof(content->'accentColor') = 'string'
      and content->>'accentColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
    ), false
  );
$$;

alter table public.card_drafts
  add constraint card_drafts_accent_color_valid
  check (public.validate_card_accent_color(content));

alter table public.card_published
  add constraint card_published_accent_color_valid
  check (public.validate_card_accent_color(content));
