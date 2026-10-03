/**
 * Formato do conteúdo do cartão (PRD §8, §9) e dos 6 tipos de botão (§13).
 */

type BaseButton = {
  id: string;
  enabled: boolean;
  /** Ícone do sistema (chave) ou URL de upload (etapa 10). Opcional em todos os tipos (PRD §12). */
  icon?: string;
};

/** PRD §13.1. Único tipo com URL — restrita a http(s) (§46). */
export type LinkButton = BaseButton & {
  type: "link";
  title: string;
  description?: string;
  url: string;
};

/** PRD §13.2. */
export type TextButton = BaseButton & {
  type: "text";
  title: string;
  description?: string;
  content: string;
};

/** PRD §13.3. Sem campo de título no PRD — fica opcional. */
export type WifiButton = BaseButton & {
  type: "wifi";
  title?: string;
  ssid: string;
  password: string;
};

/** PRD §13.4. Chave é texto puro — o PRD é explícito: não valida CPF/CNPJ/e-mail/etc. */
export type PixButton = BaseButton & {
  type: "pix";
  title?: string;
  key: string;
};

/** PRD §13.5. */
export type PhoneButton = BaseButton & {
  type: "phone";
  title?: string;
  number: string;
};

/** PRD §13.6. */
export type AddressButton = BaseButton & {
  type: "address";
  title?: string;
  address: string;
};

export type CardButton =
  | LinkButton
  | TextButton
  | WifiButton
  | PixButton
  | PhoneButton
  | AddressButton;

export type ButtonType = CardButton["type"];

export const TIPOS_DE_BOTAO: readonly ButtonType[] = [
  "link",
  "text",
  "wifi",
  "pix",
  "phone",
  "address",
];

export type CardContent = {
  displayName?: string;
  profession?: string;
  professionColor?: string;
  description?: string;
  backgroundColor?: string;
  buttonColor?: string;
  profilePhoto?: string;
  banner?: string;
  backgroundImage?: string;
  buttons: CardButton[];
};

/** Conteúdo inicial de um cartão recém-criado — rascunho em branco válido. */
export const CONTEUDO_INICIAL: CardContent = { buttons: [] };
