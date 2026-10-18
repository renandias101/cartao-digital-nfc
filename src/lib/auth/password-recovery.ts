import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const PASSWORD_RESET_PUBLIC_MESSAGE =
  "Se o usuário estiver ativo, a administração foi avisada. Ela definirá uma nova senha e informará você por um canal seguro.";

export type PasswordResetRequestResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function requestPasswordReset(usernameInput: string, source: string): Promise<PasswordResetRequestResult> {
  const username = usernameInput.trim().toLowerCase();
  if (!username || username.length > 64) return { ok: true, message: PASSWORD_RESET_PUBLIC_MESSAGE };

  const sourceHash = createHash("sha256").update(source || "unknown").digest("hex");
  const usernameHash = createHash("sha256").update(username).digest("hex");
  const admin = createSupabaseAdminClient();
  let { data, error } = await admin.rpc("request_password_reset", {
    p_username: username,
    p_username_hash: usernameHash,
    p_source_hash: sourceHash,
  });

  // Mantém o formulário funcional enquanto a migration que adiciona o hash
  // do usuário ainda não foi aplicada. Depois da migration, a chamada acima
  // é usada normalmente e este fallback deixa de ser executado.
  if (error?.code === "PGRST202") {
    ({ data, error } = await admin.rpc("request_password_reset", {
      p_username: username,
      p_source_hash: sourceHash,
    }));
  }

  if (error) {
    console.error("Falha ao registrar pedido de redefinição de senha.", { code: error.code });
    return { ok: false, message: "Não foi possível enviar o pedido agora. Tente novamente." };
  }
  if (data === "rate_limited") {
    return { ok: false, message: "Muitas tentativas foram feitas. Aguarde uma hora para tentar novamente." };
  }
  return { ok: true, message: PASSWORD_RESET_PUBLIC_MESSAGE };
}
