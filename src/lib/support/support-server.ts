import "server-only";

import { getActor } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ENVIOS_SUPORTE_POR_HORA, validarSuporte, type SupportInput, type SupportKind } from "@/lib/support/support";

export type Resultado = { ok: true } | { ok: false; mensagem: string };

/**
 * Grava o pedido em nome de quem está logado. O `client_id` vem da sessão,
 * e o banco confere de novo (`client_id = auth.uid()` na política).
 */
export async function enviarPedidoSuporte(input: SupportInput): Promise<Resultado> {
  const actor = await getActor();
  if (!actor.logado) return { ok: false, mensagem: "Sessão expirada. Faça login novamente." };
  if (actor.isAdmin) return { ok: false, mensagem: "O suporte é para clientes." };

  const validacao = validarSuporte(input);
  if (!validacao.valido) return { ok: false, mensagem: validacao.mensagem };
  const { pedido } = validacao;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("support_requests").insert({
    client_id: actor.userId,
    kind: pedido.kind,
    message: pedido.message,
    error_text: pedido.kind === "error" ? pedido.errorText : null,
  });
  if (error) {
    // 42501: política recusou — na prática, o limite de envios por hora.
    if (error.code === "42501") {
      return {
        ok: false,
        mensagem: `Você já enviou ${ENVIOS_SUPORTE_POR_HORA} mensagens na última hora. Aguarde um pouco para enviar outra.`,
      };
    }
    return { ok: false, mensagem: "Não foi possível enviar. Tente novamente." };
  }
  return { ok: true };
}

export type PedidoSuporte = {
  id: number;
  kind: SupportKind;
  message: string;
  errorText: string | null;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  cliente: { nome: string; username: string } | null;
};

/**
 * Lista para o administrador (RLS: só admin lê), mais novos no topo.
 * Filtra por status, por cliente, ou pelos dois.
 */
export async function listarPedidosSuporte(filtro: {
  status?: "open" | "resolved";
  clientId?: string;
  limite?: number;
}): Promise<PedidoSuporte[] | null> {
  const supabase = await createSupabaseServerClient();
  let consulta = supabase
    .from("support_requests")
    .select("id, kind, message, error_text, status, created_at, resolved_at, clients(full_name, username)");
  if (filtro.status) consulta = consulta.eq("status", filtro.status);
  if (filtro.clientId) consulta = consulta.eq("client_id", filtro.clientId);
  const { data, error } = await consulta.order("created_at", { ascending: false }).limit(filtro.limite ?? 100);
  if (error || !data) return null;
  return data.map((row) => {
    const cliente = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      id: row.id,
      kind: row.kind,
      message: row.message,
      errorText: row.error_text,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      cliente: cliente ? { nome: cliente.full_name, username: cliente.username } : null,
    };
  });
}

export async function contarPedidosAbertos(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("support_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  return count ?? 0;
}

/** Marca como resolvido ou reabre. Só o administrador (confere aqui e no banco). */
export async function alterarStatusSuporte(id: number, resolvido: boolean): Promise<Resultado> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) return { ok: false, mensagem: "Apenas o administrador pode alterar." };
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, mensagem: "Pedido inválido." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("support_requests")
    .update(resolvido ? { status: "resolved", resolved_at: new Date().toISOString() } : { status: "open", resolved_at: null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, mensagem: "Não foi possível atualizar o pedido." };
  return { ok: true };
}
