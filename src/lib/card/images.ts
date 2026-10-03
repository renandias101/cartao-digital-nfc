import "server-only";
import { randomUUID } from "node:crypto";

import { getActor } from "@/lib/auth/session";
import { processarImagem, type PropositoImagem } from "@/lib/card/image-processing";
import { UPLOAD_IMAGEM } from "@/lib/constants";
import { imageUploadPath, isImagePurpose } from "@/lib/card/image-upload";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type { PropositoImagem };
export type ResultadoUpload = { ok: true; url: string } | { ok: false; mensagem: string };

const BUCKET = "card-images";

function caminhoDoArquivo(clientId: string, proposito: PropositoImagem, buttonId?: string): string {
  const nome = proposito === "icon" ? `icon-${buttonId ?? "sem-id"}.webp` : `${proposito}.webp`;
  return `${clientId}/${nome}`;
}

/**
 * Faz upload de uma imagem do cartão (PRD §10, §12).
 *
 * Cada upload cria uma versão: jamais sobrescreve a imagem publicada
 * enquanto o cliente edita o rascunho. Não exclui versões anteriores.
 */
export async function uploadImagem(
  proposito: PropositoImagem,
  arquivo: File,
): Promise<ResultadoUpload> {
  if (!isImagePurpose(proposito)) {
    return { ok: false, mensagem: "Tipo de imagem inválido." };
  }
  const actor = await getActor();
  if (!actor.logado) {
    return { ok: false, mensagem: "Sessão expirada. Faça login novamente." };
  }

  if (arquivo.size === 0) {
    return { ok: false, mensagem: "Arquivo vazio." };
  }
  if (arquivo.size > UPLOAD_IMAGEM.tamanhoMaximoBytes) {
    return { ok: false, mensagem: "A imagem precisa ter no máximo 5 MB." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const processado = await processarImagem(buffer, proposito);
  if (!processado.ok) {
    return processado;
  }

  const caminho = imageUploadPath(actor.userId, proposito, randomUUID());

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, processado.buffer, {
    contentType: "image/webp",
    upsert: false,
  });

  if (error) {
    return { ok: false, mensagem: "Não foi possível enviar a imagem. Tente novamente." };
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  return { ok: true, url: publicUrlData.publicUrl };
}

/** Remove a imagem de um propósito (ex.: cliente decide voltar a usar só cor de fundo). */
export async function removerImagem(proposito: PropositoImagem, buttonId?: string): Promise<void> {
  const actor = await getActor();
  if (!actor.logado) return;

  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(BUCKET).remove([caminhoDoArquivo(actor.userId, proposito, buttonId)]);
}

/**
 * Remove TODAS as imagens de um cliente (foto, banner, fundo, ícones de
 * botão) — chamada só pela exclusão de cliente (PRD §34: "apagará
 * permanentemente a conta, o cartão e todos os dados vinculados").
 *
 * Achado na auditoria de segurança/LGPD da etapa 15: `delete_client` só
 * apaga as linhas do banco — os arquivos ficavam órfãos no bucket para
 * sempre, o que contraria tanto o texto do PRD quanto o aviso mostrado ao
 * admin na tela de exclusão. `list` + `remove` (não um caminho fixo) porque
 * o número de ícones de botão varia por cliente e não é rastreado em lugar
 * nenhum além do próprio Storage.
 *
 * Usa o cliente de SESSÃO do admin (cookies), não o de serviço: a política
 * `card_images_admin_all` já concede a um admin autenticado acesso a
 * qualquer pasta do bucket — não há motivo para a chave secreta aqui.
 */
export async function removerTodasImagensDoCliente(clientId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.storage.from(BUCKET).list(clientId);
  if (!data || data.length === 0) return;

  const caminhos = data.map((arquivo) => `${clientId}/${arquivo.name}`);
  await supabase.storage.from(BUCKET).remove(caminhos);
}
