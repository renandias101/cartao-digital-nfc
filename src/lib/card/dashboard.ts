import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PainelCliente = {
  username: string;
  fullName: string;
  status: "active" | "expired" | "cancelled";
  daysUntilExpiry: number;
  expiresAt: string;
  temAlteracoesNaoPublicadas: boolean;
};

/**
 * Dados do painel do próprio cliente logado. A view é `security_invoker`:
 * a RLS limita à própria linha (D31).
 */
export async function buscarPainelDoCliente(): Promise<PainelCliente | null> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  // Mesma visão do painel do admin (RLS: o cliente só vê a própria linha).
  // `card_state` compara o CONTEÚDO do rascunho com o publicado — as datas
  // acusavam alteração pendente depois de "Descartar alterações".
  const cliente = await supabase
    .from("admin_client_overview")
    .select("username, full_name, status, days_until_expiry, expires_at, card_state")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (cliente.error || !cliente.data) {
    return null;
  }

  return {
    username: cliente.data.username,
    fullName: cliente.data.full_name,
    status: cliente.data.status,
    daysUntilExpiry: cliente.data.days_until_expiry,
    expiresAt: cliente.data.expires_at,
    temAlteracoesNaoPublicadas: cliente.data.card_state !== "up_to_date",
  };
}
