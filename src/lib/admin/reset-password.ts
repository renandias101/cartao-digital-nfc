import "server-only";

import { SENHA_MINIMA } from "@/lib/auth/constants";
import { getActor } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResultadoResetSenha = { ok: true; auditoriaPendente?: boolean } | { ok: false; mensagem: string };

export async function registrarAuditoriaResetSenha(clientId: string): Promise<boolean> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) return false;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_log_password_reset", { p_client_id: clientId });
  return !error;
}

/**
 * Administrador redefine a senha de um cliente (PRD §4: "o administrador
 * poderá redefinir a senha").
 *
 * Usa o cliente de serviço (API admin do Auth) — por isso o portão de
 * autorização é explícito aqui, não delegado ao RLS.
 */
export async function redefinirSenha(
  clientId: string,
  _username: string,
  novaSenha: string,
): Promise<ResultadoResetSenha> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) {
    return { ok: false, mensagem: "Não autorizado." };
  }
  if (novaSenha.length < SENHA_MINIMA) {
    return { ok: false, mensagem: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(clientId, { password: novaSenha });
  if (error) {
    return { ok: false, mensagem: "Não foi possível redefinir a senha. Tente novamente." };
  }

  const auditoriaRegistrada = await registrarAuditoriaResetSenha(clientId);

  return { ok: true, auditoriaPendente: !auditoriaRegistrada };
}
