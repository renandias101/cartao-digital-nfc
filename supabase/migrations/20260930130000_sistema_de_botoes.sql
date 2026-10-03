-- ============================================================================
-- Sistema de botões: validação profunda dos 6 tipos (PRD §11, §12, §13, §46).
--
-- A etapa 7 só garantia a forma geral (`buttons` é array, ≤10 elementos,
-- ≤64KB). Esta migration valida CADA botão: campos comuns (id, type,
-- enabled, icon) e os campos específicos de cada um dos 6 tipos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Um botão (PRD §13). `enabled` é o que faz um botão desativado não aparecer
-- na página pública (§11) — sem precisar de outra tabela ou coluna.
--
-- `coalesce(..., false)` no final: mesma lição da etapa 7 (D34) — `NULL ~
-- regex`, `NULL IN (...)` e comparações do tipo `NULL = 'x'` devolvem `NULL`,
-- não `false`, e uma CHECK constraint que resulta em `NULL` é tratada como
-- aprovada. Em vez de caçar cada sub-expressão individualmente de novo,
-- desta vez a rede de segurança é no resultado inteiro: a função NUNCA
-- devolve `NULL`, só `true` ou `false`.
-- ---------------------------------------------------------------------------
create or replace function public.validate_button(btn jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(btn) = 'object'
    and btn->>'id' is not null and length(btn->>'id') between 1 and 64
    and btn->'enabled' is not null and jsonb_typeof(btn->'enabled') = 'boolean'
    and (btn->'icon' is null or jsonb_typeof(btn->'icon') = 'string')
    and (
      btn->'title' is null
      or (jsonb_typeof(btn->'title') = 'string' and length(btn->>'title') <= 40)
    )
    and (
      btn->'description' is null
      or (jsonb_typeof(btn->'description') = 'string' and length(btn->>'description') <= 100)
    )
    and (
      case btn->>'type'
        -- 13.1 Link personalizado: título obrigatório, URL http(s) apenas
        -- (PRD §46 — bloqueia javascript:/data:, mesmo raciocínio do upload
        -- de ícone recusando SVG por ser executável).
        when 'link' then
          btn->'title' is not null and length(btn->>'title') between 1 and 40
          and btn->>'url' is not null
          and btn->>'url' ~ '^https?://\S+$'

        -- 13.2 Texto/Informação: título obrigatório, conteúdo até 1000.
        when 'text' then
          btn->'title' is not null and length(btn->>'title') between 1 and 40
          and btn->>'content' is not null
          and length(btn->>'content') between 1 and 1000

        -- 13.3 Wi-Fi: SSID e senha. PRD não define título para este tipo —
        -- fica opcional (já coberto pela checagem genérica de `title` acima).
        when 'wifi' then
          btn->>'ssid' is not null and length(btn->>'ssid') between 1 and 100
          and btn->>'password' is not null and length(btn->>'password') <= 100

        -- 13.4 PIX: chave como texto puro, sem validar CPF/CNPJ/e-mail/etc
        -- (PRD é explícito: "não será necessário identificar" o tipo de chave).
        when 'pix' then
          btn->>'key' is not null and length(btn->>'key') between 1 and 200

        -- 13.5 Telefone: número como texto.
        when 'phone' then
          btn->>'number' is not null and length(btn->>'number') between 1 and 30

        -- 13.6 Endereço: texto livre.
        when 'address' then
          btn->>'address' is not null and length(btn->>'address') between 1 and 300

        else false
      end
    ),
    false
  );
$$;

revoke execute on function public.validate_button(jsonb) from public;
grant execute on function public.validate_button(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Valida o array inteiro. `bool_and` sobre zero linhas devolve NULL (agregado
-- vazio) — `coalesce(..., true)` trata array vazio como válido (nenhum botão
-- para invalidar), não como reprovado.
-- ---------------------------------------------------------------------------
create or replace function public.validate_all_buttons(buttons jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select bool_and(public.validate_button(elem)) from jsonb_array_elements(buttons) as elem),
    true
  );
$$;

revoke execute on function public.validate_all_buttons(jsonb) from public;
grant execute on function public.validate_all_buttons(jsonb) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'card_drafts_valida_botoes'
  ) then
    alter table public.card_drafts
      add constraint card_drafts_valida_botoes
      check (public.validate_all_buttons(content->'buttons'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'card_published_valida_botoes'
  ) then
    alter table public.card_published
      add constraint card_published_valida_botoes
      check (public.validate_all_buttons(content->'buttons'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reforço retroativo: embrulha também `validate_card_content` (etapa 7) no
-- mesmo `coalesce(..., false)`, como rede de segurança adicional — a etapa 7
-- já corrigiu o caso conhecido (cor ausente), isto cobre qualquer outro caso
-- não percebido pela mesma classe de bug.
-- ---------------------------------------------------------------------------
create or replace function public.validate_card_content(
  content jsonb,
  require_complete boolean default false
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      (not require_complete and content->>'displayName' is null)
      or (
        content->>'displayName' is not null
        and length(content->>'displayName') between 1 and 60
      )
    )
    and (
      content->>'description' is null
      or length(content->>'description') <= 250
    )
    and (
      (not require_complete and content->>'backgroundColor' is null)
      or (
        content->>'backgroundColor' is not null
        and content->>'backgroundColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
      )
    )
    and (
      (not require_complete and content->>'buttonColor' is null)
      or (
        content->>'buttonColor' is not null
        and content->>'buttonColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
      )
    )
    and (content->'profilePhoto' is null or jsonb_typeof(content->'profilePhoto') = 'string')
    and (content->'banner' is null or jsonb_typeof(content->'banner') = 'string')
    and (content->'backgroundImage' is null or jsonb_typeof(content->'backgroundImage') = 'string'),
    false
  );
$$;
