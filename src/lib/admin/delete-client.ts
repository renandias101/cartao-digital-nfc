import "server-only";

import { getActor } from "@/lib/auth/session";
import { removerTodasImagensDoCliente } from "@/lib/card/images";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResultadoExclusao = { ok: true; aviso?: string } | { ok: false; mensagem: string };

/**
 * Exclusão definitiva de um cliente (PRD §34 + carência de 3 meses cancelado).
 *
 * Ordem importa:
 * 1. Confere a elegibilidade e remove todas as imagens em lotes. Se falhar,
 *    preserva a ficha para que o administrador possa repetir a limpeza.
 * 2. `delete_client` pela sessão do admin — a política do banco confere de
 *    novo a carência de 3 meses no momento da exclusão.
 * 3. Remove a conta de login (`auth.users`) pela API admin. Antes ela ficava para
 *    trás: o cliente excluído ainda conseguia entrar. Apagar a conta ANTES
 *    não serve — ela cascateia para `clients` e passaria por cima da regra.
 */
export async function excluirCliente(clientId: string): Promise<ResultadoExclusao> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) {
    return { ok: false, mensagem: "Apenas o administrador pode excluir clientes." };
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    return { ok: false, mensagem: "Cliente inválido." };
  }

  const supabase = await createSupabaseServerClient();
  // Confere a carência antes de tocar no Storage. A política/RPC confere de
  // novo no momento da exclusão e continua sendo a autoridade final.
  const { data: cliente, error: erroElegibilidade } = await supabase
    .from("admin_client_overview")
    .select("deletion_eligible_at")
    .eq("id", clientId)
    .maybeSingle();
  const elegivelEm = cliente?.deletion_eligible_at ? new Date(cliente.deletion_eligible_at) : null;
  if (erroElegibilidade || !elegivelEm || Number.isNaN(elegivelEm.getTime()) || elegivelEm > new Date()) {
    return {
      ok: false,
      mensagem: "Exclusão não permitida: o cliente precisa estar cancelado há pelo menos 3 meses. Atualize a página.",
    };
  }

  const imagens = await removerTodasImagensDoCliente(clientId);
  if (!imagens.ok) {
    return {
      ok: false,
      mensagem: `${imagens.mensagem} A conta foi preservada; tente excluir novamente para continuar a limpeza.`,
    };
  }

  const { error } = await supabase.rpc("delete_client", { p_client_id: clientId });
  if (error) {
    return {
      ok: false,
      mensagem: "Exclusão não permitida: o cliente precisa estar cancelado há pelo menos 3 meses. Atualize a página.",
    };
  }

  const { error: erroConta } = await createSupabaseAdminClient().auth.admin.deleteUser(clientId);
  if (erroConta) {
    console.error(`Exclusão de cliente: dados apagados, mas a conta de login não foi removida (${erroConta.message}).`);
    return { ok: true, aviso: "Cliente excluído, mas a conta de login não pôde ser removida. Remova-a no painel do Supabase (Authentication)." };
  }
  return { ok: true };
}
