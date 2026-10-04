import { getContrastingColor } from "@/lib/card/profession";
import type { CardButton, CardContent, LinkButton } from "@/lib/card/types";

const HEX_COLOR = /^#([\da-f]{3}|[\da-f]{6})$/i;

/**
 * Cor de destaque (Salvar Contato, borda da foto, ícones). A escolha do
 * cliente só vale se for hex — o rascunho pode ser gravado direto no banco,
 * então nada fora do formato chega ao `style`. Sem escolha, mantém a regra
 * anterior: dourado quando fundo e botões são escuros, senão a cor dos botões.
 * Independente da cor da profissão.
 */
export function getAccentColor(content: CardContent): string {
  if (content.accentColor && HEX_COLOR.test(content.accentColor)) return content.accentColor;
  const surface = content.buttonColor ?? "#1c1c1c";
  const isDark = getContrastingColor(content.backgroundColor ?? "#ffffff") === "#ffffff"
    && getContrastingColor(surface) === "#ffffff";
  return isDark ? "#ffbf52" : surface;
}

export type FeaturedLinkKind = "whatsapp" | "instagram" | "linkedin" | "email";

/**
 * Ícones do sistema que o cliente pode escolher para um botão. O valor fica
 * em `button.icon` como chave; uma URL ali continua sendo ícone enviado.
 */
export const SYSTEM_ICONS = {
  monitor: "Computador / serviços",
  link: "Link",
  "map-pin": "Localização",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  email: "E-mail",
  note: "Texto / informação",
  lock: "Cadeado / Wi-Fi",
  card: "Cartão / PIX",
} as const;

export type SystemIconKey = keyof typeof SYSTEM_ICONS;

export function isSystemIconKey(icon: string | undefined): icon is SystemIconKey {
  return icon !== undefined && Object.hasOwn(SYSTEM_ICONS, icon);
}

export function isUploadedIcon(icon: string | undefined): icon is string {
  return !!icon && (icon.startsWith("https://") || icon.startsWith("/"));
}

/** Ícone escolhido pelo cliente; sem escolha, deduz pelo tipo e pelo título. */
export function resolveButtonIcon(button: CardButton): SystemIconKey {
  if (isSystemIconKey(button.icon)) return button.icon;
  const title = button.title?.toLocaleLowerCase("pt-BR") ?? "";
  if (button.type === "link" && /serviç/.test(title)) return "monitor";
  if (/localiza|endereç/.test(title)) return "map-pin";
  switch (button.type) {
    case "link": return "link";
    case "text": return "note";
    case "wifi": return "lock";
    case "pix": return "card";
    case "phone": return "phone";
    case "address": return "map-pin";
  }
}

const FEATURED_HOSTS: ReadonlyArray<{
  kind: FeaturedLinkKind;
  matches: (hostname: string) => boolean;
}> = [
  { kind: "whatsapp", matches: (hostname) => hostname === "wa.me" || hostname.endsWith(".whatsapp.com") || hostname === "whatsapp.com" },
  { kind: "instagram", matches: (hostname) => hostname === "instagram.com" || hostname.endsWith(".instagram.com") },
  { kind: "linkedin", matches: (hostname) => hostname === "linkedin.com" || hostname.endsWith(".linkedin.com") || hostname === "lnkd.in" },
];

/**
 * Reconhece apenas destinos que já passaram pela regra http(s) do produto.
 * O título serve como fallback para links de webmail configurados pelo cliente;
 * não transforma texto em URL nem aceita esquemas adicionais.
 */
export function getFeaturedLinkKind(button: CardButton): FeaturedLinkKind | null {
  if (button.type !== "link") return null;

  let hostname = "";
  try {
    hostname = new URL(button.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }

  const byHost = FEATURED_HOSTS.find((entry) => entry.matches(hostname));
  if (byHost) return byHost.kind;

  const title = button.title.trim().toLocaleLowerCase("pt-BR");
  return /^(e-?mail|email)$/.test(title) ? "email" : null;
}

export type ButtonLayout = "square" | "row";

const TYPE_NAMES: Record<CardButton["type"], string> = {
  link: "link", text: "texto", wifi: "Wi-Fi", pix: "PIX", phone: "telefone", address: "endereço",
};

/**
 * Quadrado é atalho de um toque com logo: só link (abre direto) e com ícone
 * reconhecível — rede detectada pela URL, ícone escolhido ou ícone enviado.
 * A mensagem explica ao cliente por que o botão não pode ser quadrado.
 */
export function checkSquareEligibility(button: CardButton): { ok: true } | { ok: false; mensagem: string } {
  if (button.type !== "link") {
    return {
      ok: false,
      mensagem: `Só botões de link podem ser quadrados, porque abrem com um único toque. Um botão de ${TYPE_NAMES[button.type]} abre detalhes antes (como senha, chave ou endereço), então fica no formato retângulo.`,
    };
  }
  if (!isUploadedIcon(button.icon) && !isSystemIconKey(button.icon) && !getFeaturedLinkKind(button)) {
    return {
      ok: false,
      mensagem: `Para ser quadrado, ${button.title ? `o botão “${button.title}”` : "este botão"} precisa de um logo. Edite o botão e escolha um ícone no campo “Ícone” ou envie um ícone personalizado.`,
    };
  }
  return { ok: true };
}

/**
 * Modelo efetivo de cada botão. Escolha explícita vale quando permitida;
 * sem escolha, mantém a regra anterior (até 4 redes reconhecidas no topo),
 * para cartões já publicados não mudarem sozinhos.
 */
export function getButtonLayouts(buttons: CardButton[]): Map<string, ButtonLayout> {
  const layouts = new Map<string, ButtonLayout>();
  let automaticSquares = 0;
  for (const button of buttons) {
    let layout: ButtonLayout = "row";
    if (button.layout === "square") {
      if (checkSquareEligibility(button).ok) layout = "square";
    } else if (button.layout === undefined && getFeaturedLinkKind(button) && automaticSquares < 4) {
      automaticSquares++;
      layout = "square";
    }
    layouts.set(button.id, layout);
  }
  return layouts;
}

export function organizeCardButtons(buttons: CardButton[]): {
  featured: Array<{ button: LinkButton; kind: FeaturedLinkKind | null }>;
  regular: CardButton[];
} {
  const layouts = getButtonLayouts(buttons);
  const featured: Array<{ button: LinkButton; kind: FeaturedLinkKind | null }> = [];
  const regular: CardButton[] = [];

  for (const button of buttons) {
    if (layouts.get(button.id) === "square" && button.type === "link") {
      featured.push({ button, kind: getFeaturedLinkKind(button) });
    } else {
      regular.push(button);
    }
  }

  return { featured, regular };
}

/**
 * Leva um botão para o modelo `layout`, antes de `beforeId` (null = no fim).
 * Devolve a lista com o modelo de todos explícito — quadrados primeiro, na
 * ordem em que aparecem no cartão — ou a explicação de por que não pode.
 */
export function moveButtonToLayout(
  buttons: CardButton[],
  id: string,
  layout: ButtonLayout,
  beforeId: string | null,
): { ok: true; buttons: CardButton[] } | { ok: false; mensagem: string } {
  const moving = buttons.find((button) => button.id === id);
  if (!moving) return { ok: true, buttons };
  if (layout === "square") {
    const eligibility = checkSquareEligibility(moving);
    if (!eligibility.ok) return eligibility;
  }
  const layouts = getButtonLayouts(buttons);
  const squares = buttons.filter((button) => button.id !== id && layouts.get(button.id) === "square");
  const rows = buttons.filter((button) => button.id !== id && layouts.get(button.id) === "row");
  const target = layout === "square" ? squares : rows;
  const position = beforeId ? target.findIndex((button) => button.id === beforeId) : -1;
  target.splice(position === -1 ? target.length : position, 0, moving);
  return {
    ok: true,
    buttons: [
      ...squares.map((button) => ({ ...button, layout: "square" as const })),
      ...rows.map((button) => ({ ...button, layout: "row" as const })),
    ],
  };
}

export function getCardInitials(name: string | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("") || "?";
}
