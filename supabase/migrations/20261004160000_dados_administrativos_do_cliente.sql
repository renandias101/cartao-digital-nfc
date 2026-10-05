-- ============================================================================
-- Contato administrativo do cliente (LGPD: finalidade e minimização).
--
-- Finalidade: o administrador falar com o cliente sobre vencimento,
-- renovação e pedidos de suporte. Só dois campos, os dois opcionais:
-- WhatsApp e e-mail. Nada aqui aparece no cartão, no vCard, na página
-- pública ou no painel do cliente — por isso fica numa tabela própria, e não
-- em `clients` (que o cliente lê pela política `clients_select_own`).
-- As observações internas continuam em `client_notes`.
--
-- Acesso: só administrador (mesmo modelo de `client_notes`). Excluído junto
-- com o cliente (cascade).
-- ============================================================================

create table if not exists public.client_admin_contacts (
  client_id uuid primary key references public.clients (id) on delete cascade,
  -- Só dígitos, com DDI e DDD (ex.: 5596981233398) — formato do link wa.me.
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  email text check (
    email is null
    or (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ),
  updated_at timestamptz not null default now()
);

create trigger client_admin_contacts_set_updated_at
  before update on public.client_admin_contacts
  for each row execute function public.set_updated_at();

revoke all on public.client_admin_contacts from anon, authenticated;
grant select, insert, update, delete on public.client_admin_contacts to authenticated;

alter table public.client_admin_contacts enable row level security;
alter table public.client_admin_contacts force row level security;

create policy client_admin_contacts_admin_all on public.client_admin_contacts
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
