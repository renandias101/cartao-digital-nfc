"use server";

import { revalidatePath } from "next/cache";

import { alterarStatusSuporte, classificarPedidoSuporte } from "@/lib/support/support-server";

export type SuporteActionState = { ok: boolean | null; mensagem: string | null };

/** Marca o pedido como resolvido (ou reabre). Sem retorno: a lista recarrega. */
export async function alterarStatusSuporteAction(
  id: number,
  resolvido: boolean,
  _estadoAnterior: SuporteActionState,
  _formData: FormData,
): Promise<SuporteActionState> {
  const resultado = await alterarStatusSuporte(id, resolvido);
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };
  // Layout inteiro: atualiza também o contador de abertos no menu.
  revalidatePath("/admin", "layout");
  return { ok: true, mensagem: resolvido ? "Pedido marcado como resolvido." : "Pedido reaberto." };
}

/** Classificação, prioridade e anotação interna do atendimento. */
export async function classificarSuporteAction(
  id: number,
  _estadoAnterior: SuporteActionState,
  formData: FormData,
): Promise<SuporteActionState> {
  const resultado = await classificarPedidoSuporte(id, {
    categoria: String(formData.get("categoria") ?? ""),
    prioridade: String(formData.get("prioridade") ?? ""),
    anotacao: String(formData.get("anotacao") ?? ""),
  });
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };
  revalidatePath("/admin", "layout");
  return { ok: true, mensagem: "Atendimento salvo." };
}
