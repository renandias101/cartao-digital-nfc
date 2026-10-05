"use server";

import { revalidatePath } from "next/cache";

import { alterarStatusSuporte } from "@/lib/support/support-server";

/** Marca o pedido como resolvido (ou reabre). Sem retorno: a lista recarrega. */
export async function alterarStatusSuporteAction(id: number, resolvido: boolean): Promise<void> {
  await alterarStatusSuporte(id, resolvido);
  // Layout inteiro: atualiza também o contador de abertos no menu.
  revalidatePath("/admin", "layout");
}
