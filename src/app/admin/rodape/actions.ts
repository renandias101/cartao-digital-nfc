"use server";

import { revalidatePath } from "next/cache";

import { saveCardFooterSettings } from "@/lib/system/card-footer-server";

export type SalvarRodapeState = { ok: boolean | null; mensagem: string | null };

export async function salvarRodapeAction(
  _estadoAnterior: SalvarRodapeState,
  formData: FormData,
): Promise<SalvarRodapeState> {
  const resultado = await saveCardFooterSettings({
    enabled: formData.get("enabled") === "on",
    title: String(formData.get("title") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    buttonLabel: String(formData.get("buttonLabel") ?? ""),
    url: String(formData.get("url") ?? ""),
  });
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };
  revalidatePath("/admin/rodape");
  return { ok: true, mensagem: "Rodapé salvo. Já vale para todos os cartões." };
}
