-- ============================================================================
-- Suporte: classificação, prioridade e anotação interna, definidas pelo
-- administrador. O cliente continua só enviando (tipo erro/ajuda e textos);
-- a política de insert passa a exigir que ele não preencha esses campos.
--
-- `category` vazia = deduzida do tipo do envio (erro → Erro, ajuda → Dúvida),
-- sem gravar nada até o admin mudar.
-- `admin_note`: anotação do atendimento, nunca visível ao cliente (ele não lê
-- a tabela).
-- ============================================================================

alter table public.support_requests
  add column if not exists category text,
  add column if not exists priority text not null default 'normal',
  add column if not exists admin_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'support_requests_category_check') then
    alter table public.support_requests add constraint support_requests_category_check
      check (category is null or category in ('erro', 'duvida', 'alteracao', 'financeiro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'support_requests_priority_check') then
    alter table public.support_requests add constraint support_requests_priority_check
      check (priority in ('normal', 'alta'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'support_requests_admin_note_check') then
    alter table public.support_requests add constraint support_requests_admin_note_check
      check (admin_note is null or length(admin_note) <= 2000);
  end if;
end $$;

-- Prioridade alta primeiro na lista do admin.
create index if not exists support_requests_status_priority_idx
  on public.support_requests (status, priority, created_at desc);

alter policy support_requests_insert_own on public.support_requests
  with check (
    client_id = (select auth.uid())
    and status = 'open'
    and resolved_at is null
    and category is null
    and priority = 'normal'
    and admin_note is null
    and private.support_requests_last_hour((select auth.uid())) < 5
  );
