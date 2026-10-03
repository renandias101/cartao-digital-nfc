-- ============================================================================
-- RLS, privilégios e acesso público
--
-- Modelo de acesso:
--
--  anon          nenhum privilégio de tabela. Só pode chamar
--                `public.get_public_card`, que devolve o cartão publicado de um
--                cliente ativo ou nada — sem revelar se a conta existe, se
--                venceu ou se foi cancelada (PRD §21, §24, §27, §49, §50).
--
--  authenticated cliente: lê a própria linha em `clients`, o próprio rascunho e
--                a própria versão publicada. Não escreve em tabela nenhuma
--                nesta etapa; os caminhos de escrita validados (salvar
--                rascunho, publicar, restaurar) entram na etapa 7.
--
--  admin         leitura e escrita completas, sempre via política que chama
--                `private.is_admin()`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Privilégios. RLS atua sobre o privilégio concedido, não no lugar dele: sem
-- GRANT a política nunca é avaliada, e com GRANT amplo demais a política passa
-- a ser a única barreira.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Cliente: somente leitura, e só do que lhe pertence (as políticas restringem
-- as linhas; o GRANT restringe a operação).
grant select on public.clients to authenticated;
grant select on public.card_drafts to authenticated;
grant select on public.card_published to authenticated;

-- Administrador usa o mesmo papel `authenticated`, então o GRANT de escrita
-- precisa existir para ele. Quem separa cliente de administrador é a política,
-- que exige `private.is_admin()`.
grant insert, update, delete on public.clients to authenticated;
grant insert, update, delete on public.card_drafts to authenticated;
grant insert, update, delete on public.card_published to authenticated;
grant select, insert, update, delete on public.client_notes to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
grant usage on sequence public.admin_audit_log_id_seq to authenticated;
grant select, insert, delete on public.reserved_usernames to authenticated;

-- ---------------------------------------------------------------------------
-- RLS ligada em tudo. `force row level security` garante que nem o dono da
-- tabela escape das políticas.
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.clients force row level security;
alter table public.card_drafts enable row level security;
alter table public.card_drafts force row level security;
alter table public.card_published enable row level security;
alter table public.card_published force row level security;
alter table public.client_notes enable row level security;
alter table public.client_notes force row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;
alter table public.reserved_usernames enable row level security;
alter table public.reserved_usernames force row level security;
alter table private.admins enable row level security;
alter table private.admins force row level security;

-- ---------------------------------------------------------------------------
-- clients
--
-- `(select auth.uid())` em vez de `auth.uid()` puro: dentro de subconsulta o
-- valor é calculado uma vez, não por linha.
-- ---------------------------------------------------------------------------
create policy clients_select_own on public.clients
  for select to authenticated
  using (id = (select auth.uid()));

create policy clients_select_admin on public.clients
  for select to authenticated
  using ((select private.is_admin()));

-- O cliente não altera nome de usuário, pacote, status nem vencimento (§9).
-- Por isso não existe política de UPDATE para ele: escrita é só do admin.
create policy clients_insert_admin on public.clients
  for insert to authenticated
  with check ((select private.is_admin()));

create policy clients_update_admin on public.clients
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy clients_delete_admin on public.clients
  for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- card_drafts
-- ---------------------------------------------------------------------------
create policy card_drafts_select_own on public.card_drafts
  for select to authenticated
  using (client_id = (select auth.uid()));

create policy card_drafts_select_admin on public.card_drafts
  for select to authenticated
  using ((select private.is_admin()));

create policy card_drafts_insert_admin on public.card_drafts
  for insert to authenticated
  with check ((select private.is_admin()));

create policy card_drafts_update_admin on public.card_drafts
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy card_drafts_delete_admin on public.card_drafts
  for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- card_published
--
-- O cliente lê a própria versão publicada porque precisa dela para restaurar
-- o rascunho (§18), mas não escreve: publicar é operação atômica, feita por
-- função dedicada na etapa 7. Se o cliente pudesse escrever aqui pela API de
-- dados, publicaria conteúdo sem passar por validação alguma.
-- ---------------------------------------------------------------------------
create policy card_published_select_own on public.card_published
  for select to authenticated
  using (client_id = (select auth.uid()));

create policy card_published_select_admin on public.card_published
  for select to authenticated
  using ((select private.is_admin()));

create policy card_published_insert_admin on public.card_published
  for insert to authenticated
  with check ((select private.is_admin()));

create policy card_published_update_admin on public.card_published
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy card_published_delete_admin on public.card_published
  for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- client_notes, admin_audit_log, reserved_usernames, private.admins
--
-- Nenhuma política para cliente. Sem política que lhe sirva, o cliente não
-- alcança linha alguma — inclusive as suas próprias observações internas.
-- ---------------------------------------------------------------------------
create policy client_notes_admin_all on public.client_notes
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy admin_audit_log_select_admin on public.admin_audit_log
  for select to authenticated
  using ((select private.is_admin()));

create policy admin_audit_log_insert_admin on public.admin_audit_log
  for insert to authenticated
  with check ((select private.is_admin()));

create policy reserved_usernames_select_admin on public.reserved_usernames
  for select to authenticated
  using ((select private.is_admin()));

create policy reserved_usernames_insert_admin on public.reserved_usernames
  for insert to authenticated
  with check ((select private.is_admin()));

create policy reserved_usernames_delete_admin on public.reserved_usernames
  for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Acesso público ao cartão (PRD §62)
--
-- Única porta de entrada do visitante. Devolve NULL em todos os casos em que o
-- cartão não deve aparecer — inexistente, nunca publicado, vencido ou
-- cancelado — de modo que o chamador não consegue distinguir entre eles. É
-- assim que o §21, o §24, o §27, o §49 e o §50 ficam garantidos por construção,
-- e não por disciplina de quem escreve a interface.
--
-- Recebe nome de usuário, nunca id: não há superfície para enumeração por id.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_card(p_username text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select cp.content
  from public.card_published cp
  join public.clients c on c.id = cp.client_id
  where c.username = p_username
    and public.effective_status(c.expires_at, c.cancelled_at) = 'active';
$$;

revoke execute on function public.get_public_card(text) from public;
grant execute on function public.get_public_card(text) to anon, authenticated;

comment on function public.get_public_card(text) is
  'Cartao publicado de um cliente ativo, ou NULL. Nao revela o motivo da '
  'ausencia, por exigencia do PRD (visitante nunca ve status interno).';
