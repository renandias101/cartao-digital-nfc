-- Campo opcional no JSON existente. Sem atualizar dados, tabelas ou RLS.
-- Telefone que o botão "Salvar Contato" grava no contato (vCard). O rascunho
-- pode ser gravado direto pelo cliente: só dígitos, espaço e + ( ) - . até
-- 30 caracteres (mesmo limite do botão de telefone). Vazio vale como ausente,
-- para o salvamento automático não falhar enquanto o número é digitado.
create or replace function public.validate_card_contact_phone(content jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    not (content ? 'contactPhone') or (
      jsonb_typeof(content->'contactPhone') = 'string'
      and content->>'contactPhone' ~ '^[0-9+() .-]{0,30}$'
    ), false
  );
$$;

alter table public.card_drafts
  add constraint card_drafts_contact_phone_valid
  check (public.validate_card_contact_phone(content));

alter table public.card_published
  add constraint card_published_contact_phone_valid
  check (public.validate_card_contact_phone(content));
