"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { removerTodasImagensDoCliente } from "@/lib/card/images";
import { redefinirSenha } from "@/lib/admin/reset-password";
import { atualizarNomeCliente, salvarObservacoes } from "@/lib/admin/clients";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcaoState = { ok: boolean | null; mensagem: string | null };


/**
 * `renovarAction`/`cancelarAction`/`excluirAction` chamam a RPC pelo cliente
 * comum (chave publicável + cookies da sessão do admin) — a autorização já
 * está inteira na política de RLS por trás de cada função (D26), sem
 * duplicar checagem de admin aqui.
 */
export async function renovarAction(
  clientId: string,
  username: string,
  _estadoAnterior: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  const months = Number(formData.get("months"));
  if (![3, 6, 12].includes(months)) {
    return { ok: false, mensagem: "Selecione um pacote válido." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("renew_client", {
    p_client_id: clientId,
    p_months: months,
  });

  if (error) {
    return { ok: false, mensagem: "Não foi possível renovar. Verifique e tente novamente." };
  }

  revalidatePath(`/admin/clientes/${username}`);
  return { ok: true, mensagem: "Cliente renovado com sucesso." };
}

export async function cancelarAction(
  clientId: string,
  username: string,
  _estadoAnterior: AcaoState,
  _formData: FormData,
): Promise<AcaoState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_client", { p_client_id: clientId });

  if (error) {
    return { ok: false, mensagem: "Não foi possível cancelar." };
  }

  revalidatePath(`/admin/clientes/${username}`);
  return { ok: true, mensagem: "Cliente cancelado." };
}

/**
 * Diferente das demais: numa exclusão bem-sucedida a página deixa de existir
 * (o cliente foi apagado), então o caminho de sucesso redireciona para a
 * lista em vez de devolver um estado para a mesma tela mostrar.
 */
export async function excluirAction(
  clientId: string,
  _estadoAnterior: AcaoState,
  _formData: FormData,
): Promise<AcaoState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_client", { p_client_id: clientId });

  if (error) {
    // Causa mais provável, dado que a tela só mostra esta ação para clientes
    // já CANCELADOS: uma corrida rara (renovado entre a renderização e o
    // clique). Informa em vez de redirecionar silenciosamente.
    return { ok: false, mensagem: "Não foi possível excluir. Atualize a página e tente de novo." };
  }

  // A conta já foi apagada (irreversível) — a limpeza do Storage é
  // melhor-esforço a partir daqui: uma falha aqui não desfaz nem repete a
  // exclusão, só deixaria imagens órfãs para uma faxina manual futura.
  await removerTodasImagensDoCliente(clientId);

  revalidatePath("/admin");
  redirect("/admin");
}

export async function resetSenhaAction(
  clientId: string,
  username: string,
  _estadoAnterior: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  const novaSenha = String(formData.get("new_password") ?? "");
  const resultado = await redefinirSenha(clientId, username, novaSenha);
  if (!resultado.ok) {
    return { ok: false, mensagem: resultado.mensagem };
  }
  return { ok: true, mensagem: "Senha redefinida com sucesso." };
}

export async function salvarNotasAction(
  clientId: string,
  username: string,
  _estadoAnterior: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  const notas = String(formData.get("notes") ?? "");
  await salvarObservacoes(clientId, username, notas);
  revalidatePath(`/admin/clientes/${username}`);
  return { ok: true, mensagem: "Observações salvas." };
}

/** Corrige o nome do cliente. O nome de usuário (URL do cartão) não muda. */
export async function salvarNomeAction(
  clientId: string,
  username: string,
  _estadoAnterior: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  const resultado = await atualizarNomeCliente(clientId, username, String(formData.get("full_name") ?? ""));
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };
  // Layout inteiro: o nome também aparece na lista e no suporte.
  revalidatePath("/admin", "layout");
  return { ok: true, mensagem: "Nome atualizado." };
}

