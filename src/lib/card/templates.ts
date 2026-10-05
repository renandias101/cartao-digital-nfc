import type { ButtonType, CardButton, CardContent } from "@/lib/card/types";

/**
 * Modelos de cartão (PRD §54) e duplicação sem dado pessoal (§55).
 *
 * P6 (docs/PERGUNTAS-ABERTAS.md) segue aberta: assumo que modelos são
 * presets fixos definidos aqui, não uma tela de gestão para o admin — o §35
 * não lista isso entre as capacidades do painel administrativo.
 */

/**
 * Botão de exemplo para um tipo, com dado genérico e óbvio — nunca dado
 * real. Precisa ser um botão VÁLIDO (D38: nenhum botão fica "pela metade"),
 * então "copiar estrutura sem dado pessoal" vira "estrutura com um
 * placeholder", não "estrutura com campo vazio".
 */
export function botaoPlaceholder(type: ButtonType, id: string, enabled: boolean): CardButton {
  const base = { id, enabled, type } as CardButton;
  switch (type) {
    case "link":
      return { ...base, type: "link", title: "Meu link", url: "https://exemplo.com" };
    case "text":
      return { ...base, type: "text", title: "Informações", content: "Escreva aqui as informações." };
    case "wifi":
      return { ...base, type: "wifi", ssid: "Nome da rede", password: "senha123" };
    case "pix":
      return { ...base, type: "pix", key: "chave-pix-de-exemplo" };
    case "phone":
      return { ...base, type: "phone", number: "(00) 00000-0000" };
    case "address":
      return { ...base, type: "address", address: "Endereço da empresa" };
    default:
      // Defensivo: o union do TypeScript cobre os 6 tipos, mas esta função
      // também é chamada com dado vindo do banco (duplicarConteudoSemDadosPessoais
      // lê `original.buttons`, que em tese já passou pela validação — mas
      // "em tese" não é garantia). Um tipo desconhecido aqui precisa falhar
      // alto, não devolver `undefined` silenciosamente para o chamador tratar
      // como se fosse um botão válido.
      throw new Error(`Tipo de botão desconhecido: ${String(type)}`);
  }
}

export type CardTemplate = {
  id: string;
  name: string;
  backgroundColor: string;
  buttonColor: string;
  buttonTypes: ButtonType[];
};

/** Catálogo fixo — proporcional a um MVP: poucos modelos, não um construtor de modelos. */
export const CARD_TEMPLATES: readonly CardTemplate[] = [
  {
    id: "classico",
    name: "Clássico",
    backgroundColor: "#ffffff",
    buttonColor: "#111827",
    buttonTypes: ["link", "text", "address"],
  },
  {
    id: "escuro",
    name: "Escuro",
    backgroundColor: "#0f172a",
    buttonColor: "#38bdf8",
    buttonTypes: ["link", "wifi", "pix"],
  },
  {
    id: "colorido",
    name: "Colorido",
    backgroundColor: "#fef3c7",
    buttonColor: "#ea580c",
    buttonTypes: ["link", "text", "wifi"],
  },
] as const;

export function buscarModelo(id: string): CardTemplate | undefined {
  return CARD_TEMPLATES.find((t) => t.id === id);
}

/** Conteúdo inicial a partir de um modelo — cores e botões de exemplo, sem nome nem descrição. */
export function aplicarModelo(template: CardTemplate): CardContent {
  return {
    backgroundColor: template.backgroundColor,
    buttonColor: template.buttonColor,
    buttons: template.buttonTypes.map((type) => botaoPlaceholder(type, crypto.randomUUID(), true)),
  };
}

/**
 * Duplica a APARÊNCIA de um cartão existente para um cliente novo (PRD §55).
 *
 * Copia: cor de fundo, cor dos botões, quantidade/tipo/ordem/estado dos
 * botões (a "estrutura, organização, aparência, configuração visual" que o
 * PRD autoriza reaproveitar).
 *
 * NUNCA copia: nome, descrição, foto de perfil, banner, imagem de fundo, ou
 * qualquer dado de dentro de um botão (URL, texto, SSID, senha, chave PIX,
 * telefone, endereço) — exatamente a lista que o §55 proíbe. Cada botão
 * copiado vira um placeholder do mesmo tipo, não uma cópia do original.
 */
export function duplicarConteudoSemDadosPessoais(original: CardContent): CardContent {
  return {
    backgroundColor: original.backgroundColor,
    buttonColor: original.buttonColor,
    professionColor: original.professionColor,
    accentColor: original.accentColor,
    // Telefone não é mais criado (o número fica no "Salvar Contato"): não passa adiante.
    buttons: original.buttons
      .filter((b) => b.type !== "phone")
      .map((b) => botaoPlaceholder(b.type, crypto.randomUUID(), b.enabled)),
  };
}
