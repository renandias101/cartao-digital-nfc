import { LIMITES_TEXTO } from "@/lib/constants";
import type { CardContent } from "@/lib/card/types";

/**
 * Espelha `public.validate_card_content` no banco. Usada para feedback
 * imediato na interface — o banco continua sendo a validação definitiva
 * (Seguranca 15-18); se as duas divergirem,
 * `supabase/tests/rls.test.mjs` tem um teste de paridade que pega isso.
 *
 * Mesmos dois modos da função SQL: `requireComplete=false` para salvar
 * rascunho (campo ausente é ok, campo presente precisa ser válido),
 * `requireComplete=true` para publicar (nome e cores passam a ser
 * obrigatórios).
 */
const REGEX_COR_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function validarConteudoCartao(
  content: CardContent,
  requireComplete: boolean,
): { valido: true } | { valido: false; mensagem: string } {
  const { displayName, description, backgroundColor, buttonColor, profilePhoto, banner, backgroundImage } =
    content;

  if (content.profession !== undefined &&
      (typeof content.profession !== "string" || Array.from(content.profession).length > LIMITES_TEXTO.profession)) {
    return { valido: false, mensagem: `Nicho / profissão: informe um texto de até ${LIMITES_TEXTO.profession} caracteres.` };
  }
  if (content.professionColor !== undefined &&
      (typeof content.professionColor !== "string" || !REGEX_COR_HEX.test(content.professionColor))) {
    return { valido: false, mensagem: "Cor de Nicho / profissão inválida. Use uma cor hexadecimal." };
  }
  if (content.accentColor !== undefined &&
      (typeof content.accentColor !== "string" || !REGEX_COR_HEX.test(content.accentColor))) {
    return { valido: false, mensagem: "Cor de destaque inválida. Use uma cor hexadecimal." };
  }

  if (requireComplete && !displayName) {
    return { valido: false, mensagem: "Informe o nome exibido no cartão." };
  }
  if (displayName !== undefined && displayName.length > LIMITES_TEXTO.nomeExibido) {
    return { valido: false, mensagem: `Nome exibido: máximo de ${LIMITES_TEXTO.nomeExibido} caracteres.` };
  }
  if (description !== undefined && description.length > LIMITES_TEXTO.descricaoPrincipal) {
    return { valido: false, mensagem: `Descrição: máximo de ${LIMITES_TEXTO.descricaoPrincipal} caracteres.` };
  }
  if (requireComplete && !backgroundColor) {
    return { valido: false, mensagem: "Escolha a cor de fundo." };
  }
  if (backgroundColor !== undefined && !REGEX_COR_HEX.test(backgroundColor)) {
    return { valido: false, mensagem: "Cor de fundo inválida." };
  }
  if (requireComplete && !buttonColor) {
    return { valido: false, mensagem: "Escolha a cor dos botões." };
  }
  if (buttonColor !== undefined && !REGEX_COR_HEX.test(buttonColor)) {
    return { valido: false, mensagem: "Cor dos botões inválida." };
  }
  for (const [nome, valor] of [
    ["profilePhoto", profilePhoto],
    ["banner", banner],
    ["backgroundImage", backgroundImage],
  ] as const) {
    if (valor !== undefined && typeof valor !== "string") {
      return { valido: false, mensagem: `Campo ${nome} inválido.` };
    }
  }

  return { valido: true };
}
