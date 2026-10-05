-- ============================================================================
-- Administrador edita, publica e descarta o cartão de um cliente — sem
-- entrar como o cliente (sem impersonação). Cada função recebe o cliente
-- alvo, confere `private.is_admin()` e grava auditoria.
--
-- `security invoker`: as políticas de admin que já existem em `card_drafts`
-- e `card_published` (`*_admin`) continuam sendo a barreira; a checagem
-- explícita no início só dá uma mensagem clara.
--
-- Auditoria sem conteúdo do cartão (nada de textos, links, chave PIX ou
-- senha de Wi-Fi): só a ação, o cliente, quem fez e quando.
-- ============================================================================

alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action in (
  'client_created', 'password_reset', 'renewed', 'cancelled', 'deleted', 'notes_updated', 'client_updated',
  'contacts_updated', 'card_draft_saved', 'card_published', 'card_draft_discarded', 'payment_recorded'
));

-- Registro de auditoria de uma intervenção no cartão.
create or replace function private.log_admin_card_action(p_client_id uuid, p_action text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.admin_audit_log (action, client_id, client_username, client_full_name, actor_id)
  select p_action, c.id, c.username, c.full_name, (select auth.uid())
  from public.clients c where c.id = p_client_id;
$$;

revoke execute on function private.log_admin_card_action(uuid, text) from public;
grant execute on function private.log_admin_card_action(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Salvar rascunho. O editor salva sozinho a cada pausa na digitação; para o
-- histórico não virar uma lista de centenas de "salvou", registra no máximo
-- um "editou o rascunho" por administrador e cliente a cada 30 minutos.
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_draft(p_client_id uuid, p_content jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Apenas o administrador pode editar o cartão de um cliente.';
  end if;

  update public.card_drafts set content = p_content where client_id = p_client_id;
  if not found then
    raise exception 'Rascunho do cliente não encontrado.';
  end if;

  if not exists (
    select 1 from public.admin_audit_log
    where client_id = p_client_id
      and action = 'card_draft_saved'
      and actor_id = (select auth.uid())
      and created_at > now() - interval '30 minutes'
  ) then
    perform private.log_admin_card_action(p_client_id, 'card_draft_saved');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publicar. Diferente do `publish_card` do cliente, não exige cliente ativo:
-- o admin pode deixar o cartão pronto antes de renovar. A página pública
-- continua mostrando só a página neutra enquanto o cliente não estiver ativo.
-- ---------------------------------------------------------------------------
create or replace function public.admin_publish_card(p_client_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_draft public.card_drafts%rowtype;
begin
  if not (select private.is_admin()) then
    raise exception 'Apenas o administrador pode publicar o cartão de um cliente.';
  end if;

  select * into v_draft from public.card_drafts where client_id = p_client_id;
  if not found then
    raise exception 'Nenhum rascunho encontrado para publicar.';
  end if;

  if not public.validate_card_content(v_draft.content, true) then
    raise exception 'O cartão precisa de nome, cor de fundo e cor dos botões válidos antes de publicar.';
  end if;

  insert into public.card_published (client_id, content, published_at)
  values (p_client_id, v_draft.content, now())
  on conflict (client_id) do update
    set content = excluded.content, published_at = excluded.published_at;

  perform private.log_admin_card_action(p_client_id, 'card_published');
end;
$$;

-- Descartar alterações: rascunho volta a ser a versão publicada.
create or replace function public.admin_restore_draft(p_client_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_published public.card_published%rowtype;
begin
  if not (select private.is_admin()) then
    raise exception 'Apenas o administrador pode descartar alterações do cartão de um cliente.';
  end if;

  select * into v_published from public.card_published where client_id = p_client_id;
  if not found then
    raise exception 'Nenhuma versão publicada para restaurar.';
  end if;

  update public.card_drafts set content = v_published.content where client_id = p_client_id;
  if not found then
    raise exception 'Não foi possível restaurar: rascunho não encontrado.';
  end if;

  perform private.log_admin_card_action(p_client_id, 'card_draft_discarded');
end;
$$;

revoke execute on function public.admin_save_draft(uuid, jsonb) from public;
revoke execute on function public.admin_publish_card(uuid) from public;
revoke execute on function public.admin_restore_draft(uuid) from public;
grant execute on function public.admin_save_draft(uuid, jsonb) to authenticated;
grant execute on function public.admin_publish_card(uuid) to authenticated;
grant execute on function public.admin_restore_draft(uuid) to authenticated;
