import { ESQUEMAS_URL_ACEITOS } from "@/lib/constants";

/**
 * Rodapé do sistema exibido no fim de todo cartão ativo. Só o administrador
 * altera (tabela `card_footer_settings`); o cliente não tem como removê-lo,
 * porque ele não faz parte do conteúdo do cartão.
 */
export type CardFooter = {
  title: string;
  subtitle: string;
  buttonLabel: string;
  url: string;
};

export type CardFooterSettings = CardFooter & { enabled: boolean };

/** Limites iguais aos `check` da tabela. */
export const LIMITES_RODAPE = {
  title: 60,
  subtitle: 120,
  buttonLabel: 30,
  url: 500,
} as const;

/**
 * Mesmo conteúdo semeado pela migration. Usado se a leitura do banco falhar,
 * para o rodapé não sumir dos cartões por um erro passageiro.
 */
export const RODAPE_PADRAO: CardFooter = {
  title: "Precisa de uma solução digital?",
  subtitle: "Sites, sistemas e cartões digitais para o seu negócio.",
  buttonLabel: "Solicitar serviço",
  url: "https://wa.me/5596981233398",
};

/** Espelha os `check` da tabela, para o administrador ver o erro antes do banco. */
export function validarRodape(
  input: CardFooterSettings,
): { valido: true; rodape: CardFooterSettings } | { valido: false; mensagem: string } {
  const rodape: CardFooterSettings = {
    enabled: input.enabled,
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    buttonLabel: input.buttonLabel.trim(),
    url: input.url.trim(),
  };
  if (!rodape.title || rodape.title.length > LIMITES_RODAPE.title) {
    return { valido: false, mensagem: `Título: informe de 1 a ${LIMITES_RODAPE.title} caracteres.` };
  }
  if (rodape.subtitle.length > LIMITES_RODAPE.subtitle) {
    return { valido: false, mensagem: `Subtítulo: máximo de ${LIMITES_RODAPE.subtitle} caracteres.` };
  }
  if (!rodape.buttonLabel || rodape.buttonLabel.length > LIMITES_RODAPE.buttonLabel) {
    return { valido: false, mensagem: `Texto do botão: informe de 1 a ${LIMITES_RODAPE.buttonLabel} caracteres.` };
  }
  let esquema = "";
  try {
    esquema = new URL(rodape.url).protocol;
  } catch {
    // cai na mensagem abaixo
  }
  if (
    !ESQUEMAS_URL_ACEITOS.includes(esquema as (typeof ESQUEMAS_URL_ACEITOS)[number]) ||
    !/^https?:\/\/\S+$/.test(rodape.url) ||
    rodape.url.length > LIMITES_RODAPE.url
  ) {
    return { valido: false, mensagem: "Link: use um endereço completo começando com https:// (ou http://)." };
  }
  return { valido: true, rodape };
}
