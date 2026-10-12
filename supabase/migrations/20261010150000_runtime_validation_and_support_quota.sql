-- Validação estrita de JSON e quota de suporte atômica.
create or replace function public.validate_card_content(content jsonb, require_complete boolean default false)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content->'buttons') = 'array'
    and jsonb_array_length(content->'buttons') <= 10
    and public.validate_all_buttons(content->'buttons')
    and (content->'displayName' is null or (jsonb_typeof(content->'displayName') = 'string' and length(content->>'displayName') between 1 and 60))
    and (not require_complete or (jsonb_typeof(content->'displayName') = 'string' and length(content->>'displayName') between 1 and 60))
    and (content->'profession' is null or (jsonb_typeof(content->'profession') = 'string' and length(content->>'profession') <= 60))
    and (content->'professionColor' is null or (jsonb_typeof(content->'professionColor') = 'string' and content->>'professionColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (content->'accentColor' is null or (jsonb_typeof(content->'accentColor') = 'string' and content->>'accentColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (content->'contactPhone' is null or (jsonb_typeof(content->'contactPhone') = 'string' and content->>'contactPhone' ~ '^[0-9+() .-]{0,30}$'))
    and (content->'description' is null or (jsonb_typeof(content->'description') = 'string' and length(content->>'description') <= 250))
    and (content->'backgroundColor' is null or (jsonb_typeof(content->'backgroundColor') = 'string' and content->>'backgroundColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (not require_complete or (jsonb_typeof(content->'backgroundColor') = 'string' and content->>'backgroundColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (content->'buttonColor' is null or (jsonb_typeof(content->'buttonColor') = 'string' and content->>'buttonColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (not require_complete or (jsonb_typeof(content->'buttonColor') = 'string' and content->>'buttonColor' ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'))
    and (content->'profilePhoto' is null or jsonb_typeof(content->'profilePhoto') = 'string')
    and (content->'banner' is null or jsonb_typeof(content->'banner') = 'string')
    and (content->'backgroundImage' is null or jsonb_typeof(content->'backgroundImage') = 'string'), false);
$$;

create or replace function private.enforce_support_request_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() then return new; end if;
  if new.client_id <> auth.uid() then raise exception 'Nao autorizado.' using errcode = 'insufficient_privilege'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.client_id::text, 1));
  new.created_at := now();
  if (select count(*) from public.support_requests where client_id = new.client_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Limite de pedidos de suporte atingido.' using errcode = 'program_limit_exceeded';
  end if;
  return new;
end;
$$;

create trigger support_requests_enforce_quota
  before insert on public.support_requests
  for each row execute function private.enforce_support_request_quota();

alter policy support_requests_insert_own on public.support_requests
  with check (
    client_id = (select auth.uid()) and status = 'open' and resolved_at is null
    and category is null and priority = 'normal' and admin_note is null
  );
