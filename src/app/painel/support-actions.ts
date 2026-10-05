"use server";

import { enviarPedidoSuporte } from "@/lib/support/support-server";

export type SuporteState = { ok: boolean | null; mensagem: string | null };

export async function enviarSuporteAction(_estadoAnterior: SuporteState, formData: FormData): Promise<SuporteState> {
  const kind = formData.get("kind") === "error" ? "error" : "help";
  const resultado = await enviarPedidoSuporte({
    kind,
    message: String(formData.get("message") ?? ""),
    errorText: kind === "error" ? String(formData.get("errorText") ?? "") : undefined,
  });
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };
  return { ok: true, mensagem: "Recebemos sua mensagem. Vamos analisar e entrar em contato." };
}
