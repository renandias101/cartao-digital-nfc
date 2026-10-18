import "server-only";

import { SENHA_MINIMA } from "@/lib/auth/constants";
import { getActor } from "@/lib/auth/session";
import { normalizarPagina, totalDePaginas } from "@/lib/pagination";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PasswordResetRequest = {
  id: number;
  clientId: string | null;
  username: string;
  clientName: string;
  status: "pending" | "attended" | "closed";
  requestedAt: string;
  handledBy: string | null;
  handledAt: string | null;
  result: "password_reset" | "closed_without_reset" | null;
  reason: string | null;
};

export async function listPasswordResetRequests(input: { status: "pending" | "finished"; page?: number }) {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) return null;
  const page = normalizarPagina(input.page);
  const perPage = 20;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("password_reset_requests")
    .select("id, client_id, client_username, client_full_name, status, requested_at, handled_by, handled_at, result, resolution_reason", { count: "exact" });
  query = input.status === "pending" ? query.eq("status", "pending") : query.in("status", ["attended", "closed"]);
  const { data, error, count } = await query.order("requested_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (error || !data || count === null) return null;
  return {
    requests: data.map((row): PasswordResetRequest => ({
      id: row.id,
      clientId: row.client_id,
      username: row.client_username,
      clientName: row.client_full_name,
      status: row.status,
      requestedAt: row.requested_at,
      handledBy: row.handled_by,
      handledAt: row.handled_at,
      result: row.result,
      reason: row.resolution_reason,
    })),
    total: count,
    totalPages: totalDePaginas(count, perPage),
  };
}

export async function countPendingPasswordResetRequests(): Promise<number | null> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) return null;
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase.from("password_reset_requests")
    .select("id", { count: "exact", head: true }).eq("status", "pending");
  return error || count === null ? null : count;
}

export async function fulfillPasswordResetRequest(requestId: number, newPassword: string) {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) return { ok: false as const, message: "Não autorizado." };
  if (!Number.isSafeInteger(requestId) || requestId <= 0) return { ok: false as const, message: "Pedido inválido." };
  if (newPassword.length < SENHA_MINIMA || newPassword.length > 200) {
    return { ok: false as const, message: `A senha precisa ter entre ${SENHA_MINIMA} e 200 caracteres.` };
  }

  const supabase = await createSupabaseServerClient();
  const { data: claims, error: claimError } = await supabase.rpc("admin_claim_password_reset", { p_request_id: requestId });
  const claim = claims?.[0] as { client_id?: string; claim_token?: string } | undefined;
  if (claimError || !claim?.client_id || !claim.claim_token) {
    return { ok: false as const, message: "Pedido pendente não encontrado ou já está sendo atendido." };
  }

  const admin = createSupabaseAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(claim.client_id, { password: newPassword });
  if (authError) {
    await supabase.rpc("admin_release_password_reset_claim", {
      p_request_id: requestId,
      p_claim_token: claim.claim_token,
    });
    return { ok: false as const, message: "Não foi possível redefinir a senha. O pedido continua pendente." };
  }

  const { error: completionError } = await supabase.rpc("admin_complete_password_reset", {
    p_request_id: requestId,
    p_claim_token: claim.claim_token,
  });
  if (completionError) {
    await supabase.rpc("admin_release_password_reset_claim", {
      p_request_id: requestId,
      p_claim_token: claim.claim_token,
    });
    return { ok: false as const, message: "A senha foi alterada, mas o atendimento não foi registrado. O pedido continua pendente; repita a redefinição para concluir." };
  }
  return { ok: true as const, message: "Senha redefinida e pedido marcado como atendido." };
}

export async function closePasswordResetRequest(requestId: number, reason: string) {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) return { ok: false as const, message: "Não autorizado." };
  const normalizedReason = reason.trim();
  if (!Number.isSafeInteger(requestId) || requestId <= 0) return { ok: false as const, message: "Pedido inválido." };
  if (normalizedReason.length < 3 || normalizedReason.length > 500) {
    return { ok: false as const, message: "Informe um motivo entre 3 e 500 caracteres." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_close_password_reset", {
    p_request_id: requestId,
    p_reason: normalizedReason,
  });
  return error
    ? { ok: false as const, message: "Não foi possível encerrar. O pedido continua pendente." }
    : { ok: true as const, message: "Pedido encerrado sem redefinir a senha." };
}
