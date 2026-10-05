"use server";

import { revalidatePath } from "next/cache";

import { enviarImagemDoFormulario, type PropositoImagem } from "@/lib/card/images";
import { publishCard, restoreDraft, saveDraft } from "@/lib/card/draft";
import type { CardContent } from "@/lib/card/types";

export type EstadoAcao = { ok: boolean | null; mensagem: string | null };

export async function salvarRascunhoAction(content: CardContent): Promise<EstadoAcao> {
  const resultado = await saveDraft(content);
  if (!resultado.ok) {
    return { ok: false, mensagem: resultado.mensagem };
  }
  return { ok: true, mensagem: "Rascunho salvo." };
}

export async function publicarAction(): Promise<EstadoAcao> {
  const resultado = await publishCard();
  if (!resultado.ok) {
    return { ok: false, mensagem: resultado.mensagem };
  }
  revalidatePath("/painel");
  return { ok: true, mensagem: "Alterações publicadas com sucesso." };
}

export async function restaurarAction(): Promise<EstadoAcao> {
  const resultado = await restoreDraft();
  if (!resultado.ok) {
    return { ok: false, mensagem: resultado.mensagem };
  }
  return { ok: true, mensagem: "Rascunho restaurado para a última versão publicada." };
}

export type ResultadoUploadAction =
  | { ok: true; url: string }
  | { ok: false; mensagem: string };

export async function enviarImagemAction(
  proposito: PropositoImagem,
  formData: FormData,
  buttonId?: string,
): Promise<ResultadoUploadAction> {
  return enviarImagemDoFormulario(proposito, formData, buttonId);
}
