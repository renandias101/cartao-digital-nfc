"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { atualizarNomeCliente, salvarContatos, salvarObservacoes } from "@/lib/admin/clients";
import { excluirCliente } from "@/lib/admin/delete-client";
import { lerPagamento } from "@/lib/admin/payments";
import { redefinirSenha } from "@/lib/admin/reset-password";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcaoState = { ok: boolean | null; mensagem: string | null };

/**
 * Renovar/cancelar/excluir chamam funções do banco pela sessão do admin: a
 * autorização está na RLS por trás de cada uma (D26). Todas revalidam o
 * layout do /admin para os números do topo e do menu acompanharem.
 */
export async function renovarAction(
  clientId: string,
  _username: string,
  _estadoAnterior: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  const months = Number(formData.get("months"));
  if (![3, 6, 12].includes(months)) {
    return { ok: false, mensagem: "Selecione um pacote válido." };
  }
  const pagamento = lerPagamento(formData);
  if (!pagamento.ok) return { ok: false, mensagem: pagamento.mensagem };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("renew_client_with_payment", {
    p_client_id: clientId,
    p_months: months,
    p_amount_cents: pagamento.valor.amountCents,
    p_method: pagamento.valor.method,
    p_paid_on: pagamento.valor.paidOn,
    p_note: pagamento.valor.note,
  });
  if (error) {
    return { ok: false, mensagem: "Não foi possível renovar. Verifique e tente novamente." };
  }

  revalidatePath("/admin", "layout");
  return {
    ok: true,
    mensagem: pagamento.valor.registrar ? "Cliente renovado e pagamento registrado." : "Cliente renovado com sucesso.",
  };
}

export async function cancelarAction(
  clientId: string,
  _username: string,
  _estadoAnterior: AcaoState,
  _formData: FormData,
): Promise<AcaoState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_client", { p_client_id: clientId });
  if (error) {
    return { ok: false, mensagem: "Não foi possível cancelar." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, mensagem: "Cliente cancelado." };
}

/**
 * Exclusão bem-sucedida: a ficha deixa de existir, então volta para a lista
 * (com aviso na URL quando a conta de login não pôde ser removida).
 */
export async function excluirAction(
  clientId: string,
  username: string,
  _estadoAnterior: AcaoState,
  _formData: FormData,
): Promise<AcaoState> {
  const resultado = await excluirCliente(clientId);
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };

  revalidatePath("/admin", "layout");
  const aviso = resultado.aviso ? "&conta=pendente" : "";
  redirect(`/admin?excluido=${encodeURIComponent(username)}${aviso}`);
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
  revalidatePath(`/admin/clientes/${username}`);
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

/** Nome (interno) e contato administrativo. O nome de usuário (URL do cartão) não muda. */
export async function salvarDadosAction(
  clientId: string,
  username: string,
  _estadoAnterior: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  const nome = await atualizarNomeCliente(clientId, username, String(formData.get("full_name") ?? ""));
  if (!nome.ok) return { ok: false, mensagem: nome.mensagem };
  const contatos = await salvarContatos(clientId, username, {
    whatsapp: String(formData.get("whatsapp") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!contatos.ok) return { ok: false, mensagem: contatos.mensagem };
  // Layout inteiro: o nome também aparece na lista e no suporte.
  revalidatePath("/admin", "layout");
  return { ok: true, mensagem: "Dados do cliente salvos." };
}
