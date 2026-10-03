import type { CardButton, LinkButton } from "@/lib/card/types";

export type FeaturedLinkKind = "whatsapp" | "instagram" | "linkedin" | "email";

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

export function organizeCardButtons(buttons: CardButton[]): {
  featured: Array<{ button: LinkButton; kind: FeaturedLinkKind }>;
  regular: CardButton[];
} {
  const featured: Array<{ button: LinkButton; kind: FeaturedLinkKind }> = [];
  const regular: CardButton[] = [];

  for (const button of buttons) {
    const kind = getFeaturedLinkKind(button);
    if (kind && button.type === "link" && featured.length < 4) {
      featured.push({ button, kind });
    } else {
      regular.push(button);
    }
  }

  return { featured, regular };
}

export function getCardInitials(name: string | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("") || "?";
}
