import { LIMITES_TEXTO, MAX_BOTOES, ESQUEMAS_URL_ACEITOS, contarCaracteres } from "@/lib/constants";
import type { CardButton, CardContent } from "@/lib/card/types";
import { createButtonId } from "@/lib/card/button-id";
import { checkSquareEligibility } from "@/lib/card/presentation";

/**
 * Espelha `public.validate_button` no banco. O banco continua sendo a
 * validação definitiva (Seguranca 15-18); há um teste de paridade em
 * `supabase/tests/rls.test.mjs` (seção 24) contra a função SQL.
 */
export function validarBotao(btn: CardButton): { valido: true } | { valido: false; mensagem: string } {
  if (!btn.id) {
    return { valido: false, mensagem: "Botão sem identificador." };
  }
  if (btn.title !== undefined && contarCaracteres(btn.title) > LIMITES_TEXTO.tituloBotao) {
    return { valido: false, mensagem: `Título: máximo de ${LIMITES_TEXTO.tituloBotao} caracteres.` };
  }
  if ("description" in btn && btn.description !== undefined && contarCaracteres(btn.description) > LIMITES_TEXTO.descricaoBotao) {
    return { valido: false, mensagem: `Descrição: máximo de ${LIMITES_TEXTO.descricaoBotao} caracteres.` };
  }
  if (btn.layout !== undefined && btn.layout !== "square" && btn.layout !== "row") {
    return { valido: false, mensagem: "Modelo de botão inválido." };
  }

  const porTipo = validarCamposDoTipo(btn);
  if (!porTipo.valido) return porTipo;
  if (btn.layout === "square") {
    const quadrado = checkSquareEligibility(btn);
    if (!quadrado.ok) return { valido: false, mensagem: quadrado.mensagem };
  }
  return { valido: true };
}

function validarCamposDoTipo(btn: CardButton): { valido: true } | { valido: false; mensagem: string } {
  switch (btn.type) {
    case "link": {
      if (!btn.title) return { valido: false, mensagem: "Informe o título do link." };
      if (!btn.url) return { valido: false, mensagem: "Informe a URL." };
      let esquema: string;
      try {
        esquema = new URL(btn.url).protocol;
      } catch {
        return { valido: false, mensagem: "URL inválida." };
      }
      if (!ESQUEMAS_URL_ACEITOS.includes(esquema as (typeof ESQUEMAS_URL_ACEITOS)[number])) {
        return { valido: false, mensagem: "A URL precisa começar com http:// ou https://." };
      }
      return { valido: true };
    }
    case "text": {
      if (!btn.title) return { valido: false, mensagem: "Informe o título." };
      if (!btn.content) return { valido: false, mensagem: "Informe o conteúdo do texto." };
      if (contarCaracteres(btn.content) > LIMITES_TEXTO.textoInformativo) {
        return {
          valido: false,
          mensagem: `Texto informativo: máximo de ${LIMITES_TEXTO.textoInformativo} caracteres.`,
        };
      }
      return { valido: true };
    }
    case "wifi": {
      if (!btn.ssid) return { valido: false, mensagem: "Informe o nome da rede (SSID)." };
      if (!btn.password) return { valido: false, mensagem: "Informe a senha do Wi-Fi." };
      return { valido: true };
    }
    case "pix": {
      if (!btn.key) return { valido: false, mensagem: "Informe a chave PIX." };
      return { valido: true };
    }
    case "phone": {
      if (!btn.number) return { valido: false, mensagem: "Informe o número de telefone." };
      return { valido: true };
    }
    case "address": {
      if (!btn.address) return { valido: false, mensagem: "Informe o endereço." };
      return { valido: true };
    }
  }
}

/** Valida a lista inteira, incluindo o limite de 10 (PRD §11). */
export function validarBotoes(buttons: CardButton[]): { valido: true } | { valido: false; mensagem: string } {
  if (buttons.length > MAX_BOTOES) {
    return { valido: false, mensagem: `Máximo de ${MAX_BOTOES} botões.` };
  }
  for (const btn of buttons) {
    const r = validarBotao(btn);
    if (!r.valido) return r;
  }
  return { valido: true };
}

/**
 * Operações de gerenciamento (PRD §11: criar, editar, excluir, duplicar,
 * ativar, desativar, reorganizar). Todas puras — recebem o conteúdo atual e
 * devolvem o próximo; quem persiste é `saveDraft` (src/lib/card/draft.ts).
 * A ordem do botão é a posição no array: arrastar e soltar só reordena.
 */

export function adicionarBotao(content: CardContent, botao: Omit<CardButton, "id">): CardContent {
  if (content.buttons.length >= MAX_BOTOES) {
    throw new Error(`Máximo de ${MAX_BOTOES} botões.`);
  }
  const novo = { ...botao, id: createButtonId() } as CardButton;
  return { ...content, buttons: [...content.buttons, novo] };
}

/**
 * Insere um botão que já chega com `id` definido — diferente de
 * `adicionarBotao`, que sempre gera um novo. Usada pelo editor (etapa 12):
 * o id precisa existir DESDE antes de o botão ser confirmado, porque o
 * upload de ícone (que acontece enquanto o formulário ainda está aberto)
 * já precisa de um nome de arquivo estável.
 */
export function inserirBotaoComId(content: CardContent, botao: CardButton): CardContent {
  if (content.buttons.length >= MAX_BOTOES) {
    throw new Error(`Máximo de ${MAX_BOTOES} botões.`);
  }
  return { ...content, buttons: [...content.buttons, botao] };
}

export function editarBotao(content: CardContent, id: string, alteracoes: Partial<CardButton>): CardContent {
  return {
    ...content,
    buttons: content.buttons.map((b) => (b.id === id ? ({ ...b, ...alteracoes } as CardButton) : b)),
  };
}

export function removerBotao(content: CardContent, id: string): CardContent {
  return { ...content, buttons: content.buttons.filter((b) => b.id !== id) };
}

export function duplicarBotao(content: CardContent, id: string): CardContent {
  const original = content.buttons.find((b) => b.id === id);
  if (!original) return content;
  if (content.buttons.length >= MAX_BOTOES) {
    throw new Error(`Máximo de ${MAX_BOTOES} botões.`);
  }
  const copia = { ...original, id: createButtonId() };
  const posicao = content.buttons.findIndex((b) => b.id === id);
  const buttons = [...content.buttons];
  buttons.splice(posicao + 1, 0, copia);
  return { ...content, buttons };
}

export function alternarAtivo(content: CardContent, id: string): CardContent {
  return editarBotao(content, id, {
    enabled: !content.buttons.find((b) => b.id === id)?.enabled,
  });
}

/** Reordena pela nova lista de ids, na ordem desejada (arrastar e soltar). */
export function reordenarBotoes(content: CardContent, ordemDeIds: string[]): CardContent {
  const porId = new Map(content.buttons.map((b) => [b.id, b]));
  const buttons = ordemDeIds.map((id) => porId.get(id)).filter((b): b is CardButton => b !== undefined);
  // Preserva qualquer botão fora da lista de ids informada (defensivo — não
  // deveria acontecer, mas não descarta dado do cliente por um id que faltou).
  const restantes = content.buttons.filter((b) => !ordemDeIds.includes(b.id));
  return { ...content, buttons: [...buttons, ...restantes] };
}

/** Só os botões ativos, na ordem — o que a página pública deve mostrar (PRD §11). */
export function botoesVisiveis(content: CardContent): CardButton[] {
  return content.buttons.filter((b) => b.enabled);
}
