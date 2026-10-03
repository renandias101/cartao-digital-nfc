import { UPLOAD_IMAGEM } from "@/lib/constants";
import type { PropositoImagem } from "@/lib/card/image-processing";

export function validateImageFile(file: Pick<File, "size" | "type">): string | null {
  if (file.size === 0) return "Arquivo vazio.";
  if (file.size > UPLOAD_IMAGEM.tamanhoMaximoBytes) return "A imagem precisa ter no máximo 5 MB.";
  if (!(UPLOAD_IMAGEM.tiposAceitos as readonly string[]).includes(file.type)) {
    return "Formato não suportado. Envie uma imagem JPG, PNG ou WebP.";
  }
  return null;
}

export function isImagePurpose(value: unknown): value is PropositoImagem {
  return typeof value === "string" && ["profile", "banner", "background", "icon"].includes(value);
}

/** Versões distintas evitam sobrescrever arquivos referenciados pelo publicado. */
export function imageUploadPath(clientId: string, purpose: PropositoImagem, version: string): string {
  return `${clientId}/${purpose}-${version}.webp`;
}
