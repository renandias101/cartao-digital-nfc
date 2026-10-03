-- ============================================================================
-- Upload de imagens (PRD §10, §12): políticas de RLS em `storage.objects`.
--
-- Pré-requisito: o bucket `card-images` já precisa existir (criado por
-- `scripts/create-storage-bucket.mjs`, não por esta migration — criar bucket
-- é uma chamada de API administrativa, não uma instrução SQL comum).
--
-- Estrutura de pasta: `{client_id}/{proposito}-{sufixo}.{ext}`. Isso é o que
-- permite a política abaixo bastar com uma checagem de prefixo de pasta —
-- confirmado na documentação oficial do Supabase Storage antes de escrever
-- (storage.foldername(name))[1]" é o primeiro segmento do caminho.
--
-- Confirmado também na documentação: bucket PÚBLICO dispensa política de
-- SELECT para o visitante — a URL pública contorna o RLS inteiramente para
-- leitura. RLS aqui só precisa cobrir escrita (upload, substituir, apagar).
-- ============================================================================

create policy card_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- SELECT + UPDATE são exigidos pela própria documentação para o `upsert`
-- funcionar (substituir uma imagem existente) — sem eles, a sobrescrita
-- falha silenciosamente.
create policy card_images_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy card_images_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy card_images_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Administrador enxerga e gerencia qualquer imagem (PRD §35: "visualizar
-- cartão").
create policy card_images_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'card-images' and (select private.is_admin()))
  with check (bucket_id = 'card-images' and (select private.is_admin()));
