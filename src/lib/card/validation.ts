import { LIMITES_TEXTO, REGEX_TELEFONE_CONTATO, contarCaracteres } from "@/lib/constants";

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
  content: unknown,
  requireComplete: boolean,
): { valido: true } | { valido: false; mensagem: string } {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return { valido: false, mensagem: "Conteúdo do cartão inválido." };
  }
  const cartao = content as Record<string, unknown>;
  const { displayName, description, backgroundColor, buttonColor, profilePhoto, banner, backgroundImage } =
    cartao;

  if (cartao.profession !== undefined &&
      (typeof cartao.profession !== "string" || Array.from(cartao.profession).length > LIMITES_TEXTO.profession)) {
    return { valido: false, mensagem: `Nicho / profissão: informe um texto de até ${LIMITES_TEXTO.profession} caracteres.` };
  }
  if (cartao.professionColor !== undefined &&
      (typeof cartao.professionColor !== "string" || !REGEX_COR_HEX.test(cartao.professionColor))) {
    return { valido: false, mensagem: "Cor de Nicho / profissão inválida. Use uma cor hexadecimal." };
  }
  if (cartao.accentColor !== undefined &&
      (typeof cartao.accentColor !== "string" || !REGEX_COR_HEX.test(cartao.accentColor))) {
    return { valido: false, mensagem: "Cor de destaque inválida. Use uma cor hexadecimal." };
  }
  if (cartao.contactPhone !== undefined &&
      (typeof cartao.contactPhone !== "string" || !REGEX_TELEFONE_CONTATO.test(cartao.contactPhone))) {
    return {
      valido: false,
      mensagem: `Telefone do Salvar Contato: use só números, espaço e + ( ) -, até ${LIMITES_TEXTO.telefoneContato} caracteres.`,
    };
  }

  if (requireComplete && !displayName) {
    return { valido: false, mensagem: "Informe o nome exibido no cartão." };
  }
  if (displayName !== undefined && (typeof displayName !== "string" || contarCaracteres(displayName) > LIMITES_TEXTO.nomeExibido)) {
    return { valido: false, mensagem: `Nome exibido: máximo de ${LIMITES_TEXTO.nomeExibido} caracteres.` };
  }
  if (description !== undefined && (typeof description !== "string" || contarCaracteres(description) > LIMITES_TEXTO.descricaoPrincipal)) {
    return { valido: false, mensagem: `Descrição: máximo de ${LIMITES_TEXTO.descricaoPrincipal} caracteres.` };
  }
  if (requireComplete && !backgroundColor) {
    return { valido: false, mensagem: "Escolha a cor de fundo." };
  }
  if (backgroundColor !== undefined && (typeof backgroundColor !== "string" || !REGEX_COR_HEX.test(backgroundColor))) {
    return { valido: false, mensagem: "Cor de fundo inválida." };
  }
  if (requireComplete && !buttonColor) {
    return { valido: false, mensagem: "Escolha a cor dos botões." };
  }
  if (buttonColor !== undefined && (typeof buttonColor !== "string" || !REGEX_COR_HEX.test(buttonColor))) {
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
    if (typeof valor === "string" && !/^\/api\/card-image\?path=[0-9a-f-]{36}\/(profile|banner|background|icon)-[0-9a-f-]{36}\.webp$/i.test(valor)) {
      return { valido: false, mensagem: `Campo ${nome}: endereço de imagem inválido.` };
    }
  }

  return { valido: true };
}
