"use server";

import { revalidatePath } from "next/cache";

import type { EstadoAcao, ResultadoUploadAction } from "@/app/painel/editor/actions";
import {
  descartarAlteracoesDoCliente,
  publicarCartaoDoCliente,
  salvarRascunhoDoCliente,
} from "@/lib/admin/card-editing";
import { getActor } from "@/lib/auth/session";
import { enviarImagemDoFormulario, type PropositoImagem } from "@/lib/card/images";
import type { CardContent } from "@/lib/card/types";

/**
 * Ações do editor quando o ADMINISTRADOR edita o cartão de um cliente.
 * A página entrega cada uma ao `CardEditor` já presa ao cliente alvo
 * (`.bind(null, clientId)`). Como esse id chega do navegador, nada aqui
 * confia nele para autorizar: quem decide é a sessão de admin (conferida em
 * `lib/admin/card-editing` e de novo no banco).
 */
export async function salvarRascunhoAdminAction(clientId: string, content: CardContent): Promise<EstadoAcao> {
  const resultado = await salvarRascunhoDoCliente(clientId, content);
  return resultado.ok ? { ok: true, mensagem: "Rascunho salvo." } : { ok: false, mensagem: resultado.mensagem };
}

export async function publicarAdminAction(clientId: string): Promise<EstadoAcao> {
  const resultado = await publicarCartaoDoCliente(clientId);
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };
  revalidatePath("/admin", "layout");
  return { ok: true, mensagem: "Alterações publicadas no cartão do cliente." };
}

export async function restaurarAdminAction(clientId: string): Promise<EstadoAcao> {
  const resultado = await descartarAlteracoesDoCliente(clientId);
  if (!resultado.ok) return { ok: false, mensagem: resultado.mensagem };
  revalidatePath("/admin", "layout");
  return { ok: true, mensagem: "Alterações descartadas." };
}

export async function enviarImagemAdminAction(
  clientId: string,
  proposito: PropositoImagem,
  formData: FormData,
  buttonId?: string,
): Promise<ResultadoUploadAction> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) return { ok: false, mensagem: "Não autorizado." };
  return enviarImagemDoFormulario(proposito, formData, buttonId, clientId);
}
