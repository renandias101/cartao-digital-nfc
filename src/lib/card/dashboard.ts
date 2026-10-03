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
 * Dados do painel do próprio cliente logado. Usa `clients_with_status`
 * (etapa 6) — RLS já limita a própria linha (D31: view herda a política da
 * tabela por ser `security_invoker`).
 */
export async function buscarPainelDoCliente(): Promise<PainelCliente | null> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [cliente, rascunho, publicado] = await Promise.all([
    supabase
      .from("clients_with_status")
      .select("username, full_name, status, days_until_expiry, expires_at")
      .eq("id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("card_drafts")
      .select("updated_at")
      .eq("client_id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("card_published")
      .select("published_at")
      .eq("client_id", userData.user.id)
      .maybeSingle(),
  ]);

  if (cliente.error || !cliente.data) {
    return null;
  }

  const semPublicacao = !publicado.data;
  const rascunhoMaisNovo =
    rascunho.data?.updated_at && publicado.data?.published_at
      ? new Date(rascunho.data.updated_at) > new Date(publicado.data.published_at)
      : false;

  return {
    username: cliente.data.username,
    fullName: cliente.data.full_name,
    status: cliente.data.status,
    daysUntilExpiry: cliente.data.days_until_expiry,
    expiresAt: cliente.data.expires_at,
    temAlteracoesNaoPublicadas: semPublicacao || rascunhoMaisNovo,
  };
}
