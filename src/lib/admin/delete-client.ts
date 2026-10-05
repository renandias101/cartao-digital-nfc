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
 * 1. `delete_client` pela sessão do admin — é a política do banco que decide
 *    se pode (cancelado há pelo menos 3 meses). Nada é apagado se recusar.
 * 2. Imagens do Storage (melhor esforço; a conta já foi apagada).
 * 3. A conta de login (`auth.users`) pela API admin. Antes ela ficava para
 *    trás: o cliente excluído ainda conseguia entrar. Apagar a conta ANTES
 *    não serve — ela cascateia para `clients` e passaria por cima da regra.
 */
export async function excluirCliente(clientId: string): Promise<ResultadoExclusao> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) {
    return { ok: false, mensagem: "Apenas o administrador pode excluir clientes." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_client", { p_client_id: clientId });
  if (error) {
    return {
      ok: false,
      mensagem: "Exclusão não permitida: o cliente precisa estar cancelado há pelo menos 3 meses. Atualize a página.",
    };
  }

  await removerTodasImagensDoCliente(clientId);

  const { error: erroConta } = await createSupabaseAdminClient().auth.admin.deleteUser(clientId);
  if (erroConta) {
    console.error(`Exclusão de cliente: dados apagados, mas a conta de login não foi removida (${erroConta.message}).`);
    return { ok: true, aviso: "Cliente excluído, mas a conta de login não pôde ser removida. Remova-a no painel do Supabase (Authentication)." };
  }
  return { ok: true };
}
