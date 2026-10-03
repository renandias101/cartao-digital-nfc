/**
 * Processamento de imagem — puro, sem `server-only`. Não toca sessão nem
 * Supabase, então é testável isoladamente (`supabase/tests/rls.test.mjs`
 * importa isto direto, sem precisar do contexto do Next). Quem lida com
 * sessão e Storage é `src/lib/card/images.ts`, que usa esta função.
 */
import sharp from "sharp";
import type * as SharpTypes from "sharp";

export type PropositoImagem = "profile" | "banner" | "background" | "icon";

/**
 * Dimensão máxima por propósito — parte da "otimização" exigida pelo PRD
 * §10, junto com a reconversão para WebP abaixo. Proporcional a onde cada
 * imagem aparece: ícone é pequeno, banner é a mais larga.
 */
export const DIMENSAO_MAXIMA: Record<PropositoImagem, number> = {
  profile: 800,
  banner: 1600,
  background: 1600,
  icon: 256,
};

export type ResultadoProcessamento =
  | { ok: true; buffer: Buffer; largura: number; altura: number }
  | { ok: false; mensagem: string };

/**
 * Recebe um arquivo de imagem, valida de verdade (decodificando os bytes,
 * não confiando em extensão nem no MIME que o navegador declarou — Seguranca
 * 53-54 do framework é explícita sobre isso) e devolve um WebP comprimido.
 *
 * `sharp` decodificando o arquivo É a validação: um arquivo que não é uma
 * imagem de verdade (ou é um formato não aceito, como GIF/SVG/BMP) falha
 * aqui, antes de qualquer coisa ir para o Storage.
 */
export async function processarImagem(
  buffer: Buffer,
  proposito: PropositoImagem,
): Promise<ResultadoProcessamento> {
  let imagem: SharpTypes.Sharp;
  let metadados: SharpTypes.Metadata;
  try {
    imagem = sharp(buffer, { failOn: "error" });
    metadados = await imagem.metadata();
  } catch {
    return { ok: false, mensagem: "Arquivo inválido. Envie uma imagem JPG, PNG ou WebP." };
  }

  // `metadados.format` vem de decodificar o arquivo de verdade — não do nome
  // nem do cabeçalho HTTP que o cliente enviou.
  if (!metadados.format || !["jpeg", "png", "webp"].includes(metadados.format)) {
    return { ok: false, mensagem: "Formato não suportado. Envie uma imagem JPG, PNG ou WebP." };
  }

  const max = DIMENSAO_MAXIMA[proposito];
  try {
    const processado = await imagem
      .rotate() // aplica a orientação EXIF antes de redimensionar, senão a foto pode sair de lado
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return {
      ok: true,
      buffer: processado.data,
      largura: processado.info.width,
      altura: processado.info.height,
    };
  } catch {
    return { ok: false, mensagem: "Não foi possível processar a imagem. Tente outro arquivo." };
  }
}
