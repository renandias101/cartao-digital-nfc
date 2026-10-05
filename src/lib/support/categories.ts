import type { SupportKind } from "@/lib/support/support";

/**
 * Classificação e prioridade do suporte, definidas pelo administrador
 * (iguais aos `check` da migration 20261004190000). Sem classificação, o
 * pedido aparece pelo tipo que o cliente escolheu: erro → Erro, ajuda → Dúvida.
 */
export const CATEGORIAS_SUPORTE = [
  { valor: "erro", rotulo: "Erro" },
  { valor: "duvida", rotulo: "Dúvida" },
  { valor: "alteracao", rotulo: "Alteração" },
  { valor: "financeiro", rotulo: "Financeiro" },
] as const;

export type CategoriaSuporte = (typeof CATEGORIAS_SUPORTE)[number]["valor"];
export type PrioridadeSuporte = "normal" | "alta";

export function isCategoriaSuporte(valor: unknown): valor is CategoriaSuporte {
  return CATEGORIAS_SUPORTE.some((c) => c.valor === valor);
}

/** Categoria efetiva: a escolhida pelo admin ou a deduzida do tipo do envio. */
export function categoriaEfetiva(categoria: CategoriaSuporte | null, kind: SupportKind): CategoriaSuporte {
  return categoria ?? (kind === "error" ? "erro" : "duvida");
}

export function rotuloCategoria(categoria: CategoriaSuporte): string {
  return CATEGORIAS_SUPORTE.find((c) => c.valor === categoria)?.rotulo ?? "Dúvida";
}
