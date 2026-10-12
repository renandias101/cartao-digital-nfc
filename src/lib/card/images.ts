import "server-only";

import { randomUUID } from "node:crypto";
import { getActor } from "@/lib/auth/session";
import { processarImagem, type PropositoImagem } from "@/lib/card/image-processing";
import { imageUploadPath, isImagePurpose } from "@/lib/card/image-upload";
import { removerArquivosEmLotes, type StorageCleanupResult } from "@/lib/card/storage-cleanup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { PropositoImagem };
export type ResultadoUpload = { ok: true; url: string } | { ok: false; mensagem: string };
export type PreparacaoUpload = { ok: true; path: string; token: string } | { ok: false; mensagem: string };
export const CARD_IMAGES_BUCKET = "card-images";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function clienteAlvo(clientIdAlvo?: string) {
  const actor = await getActor();
  if (!actor.logado) return { erro: "Sessão expirada. Faça login novamente." } as const;
  if (clientIdAlvo !== undefined && (!actor.isAdmin || !UUID.test(clientIdAlvo))) {
    return { erro: "Não autorizado." } as const;
  }
  return { clientId: clientIdAlvo ?? actor.userId } as const;
}

/** Autoriza por pouco tempo um envio direto do navegador ao Storage privado. */
export async function prepararUploadImagem(proposito: PropositoImagem, buttonId?: string, clientIdAlvo?: string): Promise<PreparacaoUpload> {
  if (!isImagePurpose(proposito) || (proposito === "icon" && !buttonId)) return { ok: false, mensagem: "Tipo de imagem inválido." };
  const alvo = await clienteAlvo(clientIdAlvo);
  if ("erro" in alvo) return { ok: false, mensagem: alvo.erro ?? "Não autorizado." };
  const path = `_staging/${alvo.clientId}/${randomUUID()}`;
  const { data, error } = await createSupabaseAdminClient().storage.from(CARD_IMAGES_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { ok: false, mensagem: "Não foi possível preparar o envio. Tente novamente." };
  return { ok: true, path, token: data.token };
}

/** Decodifica e promove a preparação para um ativo privado, versionado e imutável. */
export async function processarUploadImagem(path: string, proposito: PropositoImagem, buttonId?: string, clientIdAlvo?: string): Promise<ResultadoUpload> {
  if (!isImagePurpose(proposito) || (proposito === "icon" && !buttonId)) return { ok: false, mensagem: "Tipo de imagem inválido." };
  const alvo = await clienteAlvo(clientIdAlvo);
  if ("erro" in alvo) return { ok: false, mensagem: alvo.erro ?? "Não autorizado." };
  if (!path.startsWith(`_staging/${alvo.clientId}/`) || path.split("/").length !== 3) return { ok: false, mensagem: "Envio inválido ou expirado." };

  const bucket = createSupabaseAdminClient().storage.from(CARD_IMAGES_BUCKET);
  const { data, error } = await bucket.download(path);
  if (error || !data) return { ok: false, mensagem: "O arquivo enviado não foi encontrado. Tente novamente." };
  try {
    const processado = await processarImagem(Buffer.from(await data.arrayBuffer()), proposito);
    if (!processado.ok) return processado;
    const destino = imageUploadPath(alvo.clientId, proposito, randomUUID());
    const { error: uploadError } = await bucket.upload(destino, processado.buffer, { contentType: "image/webp", upsert: false });
    if (uploadError) return { ok: false, mensagem: "Não foi possível concluir o envio. Tente novamente." };
    return { ok: true, url: `/api/card-image?path=${destino}` };
  } catch {
    return { ok: false, mensagem: "Não foi possível processar a imagem. Verifique o arquivo e tente novamente." };
  } finally {
    await bucket.remove([path]);
  }
}

export type ResultadoRemocaoImagens = StorageCleanupResult;
export async function removerTodasImagensDoCliente(clientId: string): Promise<ResultadoRemocaoImagens> {
  const bucket = createSupabaseAdminClient().storage.from(CARD_IMAGES_BUCKET);
  const [ativos, preparacoes] = await Promise.all([
    removerArquivosEmLotes(bucket, clientId),
    removerArquivosEmLotes(bucket, `_staging/${clientId}`),
  ]);
  const removidas = ativos.removidas + preparacoes.removidas;
  if (!ativos.ok) return { ok: false, mensagem: ativos.mensagem, removidas };
  if (!preparacoes.ok) return { ok: false, mensagem: preparacoes.mensagem, removidas };
  return { ok: true, removidas };
}
