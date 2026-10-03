-- ============================================================================
-- Estrutura do cartão: validação de conteúdo, escrita do cliente, publicar
-- e restaurar (PRD §8, §9, §17, §18, §56).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Valida os campos de nível de cartão (não entra em botão — isso é etapa 8).
--
-- Dois modos:
--  - permissivo (`require_complete = false`): usado no CHECK de `card_drafts`.
--    Campo ausente é permitido — um rascunho em andamento pode estar
--    incompleto. Campo PRESENTE precisa ser válido.
--  - completo (`require_complete = true`): usado antes de publicar e no CHECK
--    de `card_published`. Nome, cor de fundo e cor dos botões passam a ser
--    obrigatórios — o PRD não lista os dois como opcionais (§8), ao contrário
--    de banner/imagem de fundo.
--
-- `immutable`: depende só do argumento, nunca de `now()` ou de outra tabela —
-- é o que permite usar isto dentro de uma CHECK constraint.
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
  select
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
    and (content->'backgroundImage' is null or jsonb_typeof(content->'backgroundImage') = 'string');
$$;

revoke execute on function public.validate_card_content(jsonb, boolean) from public;
grant execute on function public.validate_card_content(jsonb, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- CHECK constraints usando a função acima. `DO` + checagem em `pg_constraint`
-- porque `ADD CONSTRAINT IF NOT EXISTS` não existe no Postgres (regra da
-- skill de boas práticas) — sem isso, rodar esta migration duas vezes falha.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'card_drafts_valida_conteudo'
  ) then
    alter table public.card_drafts
      add constraint card_drafts_valida_conteudo
      check (public.validate_card_content(content, false));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'card_published_valida_conteudo'
  ) then
    alter table public.card_published
      add constraint card_published_valida_conteudo
      check (public.validate_card_content(content, true));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- O cliente passa a poder escrever o PRÓPRIO rascunho (D15 da etapa 3 previa
-- isto para esta etapa). `GRANT` de tabela já existia desde a etapa 3
-- (`insert, update, delete on card_drafts to authenticated`); faltava a
-- política — sem ela, RLS negava toda linha.
-- ---------------------------------------------------------------------------
create policy card_drafts_update_own on public.card_drafts
  for update to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

-- Deliberadamente NÃO existe política para o cliente escrever em
-- `card_published` (mantém a decisão da etapa 3, D15). Publicar continua
-- sendo só por função: se o cliente pudesse fazer UPDATE direto ali, ainda
-- que validado, publicaria conteúdo que nunca passou pelo rascunho —
-- quebrando o modelo rascunho -> revisão -> publicação do PRD §16-17, e
-- fazendo `restore_draft` (abaixo) restaurar algo que o cliente nunca editou
-- de fato.

-- ---------------------------------------------------------------------------
-- Publicar (PRD §17, §64). Copia o rascunho para a versão publicada, mas só
-- se o rascunho estiver completo (`require_complete = true`) — não dá pra
-- publicar um cartão sem nome ou sem cor.
--
-- `security definer`: o cliente não tem (nem deve ter) grant de escrita em
-- `card_published` — este é o único caminho para lá. Diferente dos casos de
-- `renew_client`/`cancel_client`/`delete_client` (que recebem um `client_id`
-- de fora e por isso dependem do RLS para não afetar outro cliente), esta
-- função não recebe parâmetro nenhum: opera só sobre `auth.uid()`, então não
-- há "de quem" para um chamador manipular. É exatamente o caso em que
-- `security definer` é a ferramenta certa, não um atalho para um erro de
-- permissão (alerta da skill de Postgres).
create or replace function public.publish_card()
returns public.card_published
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.card_drafts%rowtype;
  v_published public.card_published%rowtype;
begin
  select * into v_draft from public.card_drafts where client_id = (select auth.uid());
  if not found then
    raise exception 'Nenhum rascunho encontrado para publicar.';
  end if;

  if not public.validate_card_content(v_draft.content, true) then
    raise exception 'O cartão precisa de nome, cor de fundo e cor dos botões válidos antes de publicar.';
  end if;

  insert into public.card_published (client_id, content, published_at)
  values ((select auth.uid()), v_draft.content, now())
  on conflict (client_id) do update
    set content = excluded.content, published_at = excluded.published_at
  returning * into v_published;

  return v_published;
end;
$$;

revoke execute on function public.publish_card() from public;
grant execute on function public.publish_card() to authenticated;

-- ---------------------------------------------------------------------------
-- Restaurar (PRD §18): descarta alterações não publicadas, voltando o
-- rascunho para o que está no ar. Exige que já exista algo publicado —
-- sem isso, não há "última versão publicada" para restaurar.
-- ---------------------------------------------------------------------------
create or replace function public.restore_draft()
returns public.card_drafts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_published public.card_published%rowtype;
  v_draft public.card_drafts%rowtype;
begin
  select * into v_published from public.card_published where client_id = (select auth.uid());
  if not found then
    raise exception 'Nenhuma versão publicada para restaurar.';
  end if;

  update public.card_drafts
    set content = v_published.content
    where client_id = (select auth.uid())
    returning * into v_draft;

  if not found then
    raise exception 'Não foi possível restaurar: rascunho não encontrado.';
  end if;

  return v_draft;
end;
$$;

revoke execute on function public.restore_draft() from public;
grant execute on function public.restore_draft() to authenticated;
