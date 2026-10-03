-- Campos opcionais no JSON existente. Sem atualizar dados, tabelas ou RLS.
-- Texto é dado do cliente; profissão não deve ser copiada em modelos.
create or replace function public.validate_card_profession(content jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (not (content ? 'profession') or (
      jsonb_typeof(content->'profession') = 'string'
      and length(content->>'profession') <= 60
    ))
    and (not (content ? 'professionColor') or (
      jsonb_typeof(content->'professionColor') = 'string'
      and content->>'professionColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
    )), false
  );
$$;

alter table public.card_drafts
  add constraint card_drafts_profession_valid
  check (public.validate_card_profession(content));

alter table public.card_published
  add constraint card_published_profession_valid
  check (public.validate_card_profession(content));
