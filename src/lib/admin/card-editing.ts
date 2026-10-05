import "server-only";

import { getActor } from "@/lib/auth/session";
import { validarRascunho } from "@/lib/card/draft";
import type { CardContent } from "@/lib/card/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Resultado = { ok: true } | { ok: false; mensagem: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Edição do cartão de um cliente pelo administrador — sem entrar como o
 * cliente. Três barreiras:
 * 1. aqui: sessão de administrador e id de cliente bem formado;
 * 2. nas funções do banco (`admin_*`): `private.is_admin()`;
 * 3. nas políticas `*_admin` de `card_drafts`/`card_published`.
 * As funções do banco também gravam a auditoria (sem o conteúdo do cartão).
 */
async function exigirAdmin(clientId: string): Promise<Resultado> {
  if (typeof clientId !== "string" || !UUID.test(clientId)) {
    return { ok: false, mensagem: "Cliente inválido." };
  }
  const actor = await getActor();
  if (!actor.logado) return { ok: false, mensagem: "Sessão expirada. Faça login novamente." };
  if (!actor.isAdmin) return { ok: false, mensagem: "Apenas o administrador pode editar o cartão de um cliente." };
  return { ok: true };
}

export async function salvarRascunhoDoCliente(clientId: string, content: CardContent): Promise<Resultado> {
  const acesso = await exigirAdmin(clientId);
  if (!acesso.ok) return acesso;
  const validacao = validarRascunho(content);
  if (!validacao.ok) return validacao;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_save_draft", { p_client_id: clientId, p_content: content });
  if (error) return { ok: false, mensagem: "Não foi possível salvar. Tente novamente." };
  return { ok: true };
}

export async function publicarCartaoDoCliente(clientId: string): Promise<Resultado> {
  const acesso = await exigirAdmin(clientId);
  if (!acesso.ok) return acesso;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_publish_card", { p_client_id: clientId });
  // A mensagem das funções do banco já é para gente (ex.: falta nome ou cor).
  if (error) return { ok: false, mensagem: error.message };
  return { ok: true };
}

export async function descartarAlteracoesDoCliente(clientId: string): Promise<Resultado> {
  const acesso = await exigirAdmin(clientId);
  if (!acesso.ok) return acesso;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_restore_draft", { p_client_id: clientId });
  if (error) return { ok: false, mensagem: error.message };
  return { ok: true };
}
