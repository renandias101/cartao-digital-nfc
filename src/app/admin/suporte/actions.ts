"use server";

import { revalidatePath } from "next/cache";

import { alterarStatusSuporte, classificarPedidoSuporte } from "@/lib/support/support-server";

/** Marca o pedido como resolvido (ou reabre). Sem retorno: a lista recarrega. */
export async function alterarStatusSuporteAction(id: number, resolvido: boolean): Promise<void> {
  await alterarStatusSuporte(id, resolvido);
  // Layout inteiro: atualiza também o contador de abertos no menu.
  revalidatePath("/admin", "layout");
}

/** Classificação, prioridade e anotação interna do atendimento. */
export async function classificarSuporteAction(id: number, formData: FormData): Promise<void> {
  await classificarPedidoSuporte(id, {
    categoria: String(formData.get("categoria") ?? ""),
    prioridade: String(formData.get("prioridade") ?? ""),
    anotacao: String(formData.get("anotacao") ?? ""),
  });
  revalidatePath("/admin", "layout");
}
