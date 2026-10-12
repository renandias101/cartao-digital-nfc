-- Imagens ficam privadas. Escrita normal ocorre apenas por URLs de upload
-- assinadas pelo servidor; leitura passa por /api/card-image e esta função.
drop policy if exists card_images_insert_own on storage.objects;
drop policy if exists card_images_select_own on storage.objects;
drop policy if exists card_images_update_own on storage.objects;
drop policy if exists card_images_delete_own on storage.objects;
drop policy if exists card_images_admin_all on storage.objects;

update storage.buckets
set public = false, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'card-images';

create or replace function public.can_read_card_image(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_path !~ '^[0-9a-fA-F-]{36}/(profile|banner|background|icon)-[0-9a-fA-F-]{36}[.]webp$' then false
    when (select auth.uid()) is not null and (
      split_part(p_path, '/', 1) = (select auth.uid())::text or private.is_admin()
    ) then true
    else exists (
      select 1
      from public.card_published cp
      join public.clients c on c.id = cp.client_id
      where c.id::text = split_part(p_path, '/', 1)
        and public.effective_status(c.expires_at, c.cancelled_at) = 'active'
        and (
          cp.content->>'profilePhoto' = '/api/card-image?path=' || p_path
          or cp.content->>'banner' = '/api/card-image?path=' || p_path
          or cp.content->>'backgroundImage' = '/api/card-image?path=' || p_path
          or exists (select 1 from jsonb_array_elements(coalesce(cp.content->'buttons', '[]'::jsonb)) b where b->>'icon' = '/api/card-image?path=' || p_path)
        )
    )
  end;
$$;
revoke all on function public.can_read_card_image(text) from public;
grant execute on function public.can_read_card_image(text) to anon, authenticated;

create or replace function public.card_image_refs_are_owned(content jsonb, client_id uuid)
returns boolean language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from (
      select content->>'profilePhoto' value union all
      select content->>'banner' union all
      select content->>'backgroundImage'
    ) refs
    where value is not null and value <> ''
      and value !~ ('^/api/card-image[?]path=' || client_id::text || '/(profile|banner|background|icon)-[0-9a-fA-F-]{36}[.]webp$')
  ) and not exists (
    select 1 from jsonb_array_elements(coalesce(content->'buttons', '[]'::jsonb)) b
    where (b->>'icon' like '/api/card-image?path=%' or b->>'icon' ~ '^https?://')
      and b->>'icon' !~ ('^/api/card-image[?]path=' || client_id::text || '/icon-[0-9a-fA-F-]{36}[.]webp$')
  );
$$;

alter table public.card_drafts drop constraint if exists card_drafts_image_ownership;
update public.card_drafts
set content = regexp_replace(
  content::text,
  'https://[^" ]+/storage/v1/object/public/card-images/([^"?]+)',
  '/api/card-image?path=\1', 'g'
)::jsonb
where content::text like '%/storage/v1/object/public/card-images/%';
update public.card_published
set content = regexp_replace(
  content::text,
  'https://[^" ]+/storage/v1/object/public/card-images/([^"?]+)',
  '/api/card-image?path=\1', 'g'
)::jsonb
where content::text like '%/storage/v1/object/public/card-images/%';
alter table public.card_drafts add constraint card_drafts_image_ownership check (public.card_image_refs_are_owned(content, client_id));
alter table public.card_published drop constraint if exists card_published_image_ownership;
alter table public.card_published add constraint card_published_image_ownership check (public.card_image_refs_are_owned(content, client_id));
