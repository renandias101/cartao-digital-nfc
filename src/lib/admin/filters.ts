/**
 * Filtros da lista de clientes. As chaves são as mesmas que
 * `admin_list_clients` entende no banco (migration 20261004200000).
 * Principais ficam visíveis; os adicionais vão num seletor.
 */
export const FILTROS_PRINCIPAIS = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "vence_em_15_dias", rotulo: "Vencem em até 15 dias" },
  { valor: "vencidos", rotulo: "Vencidos" },
  { valor: "cancelados", rotulo: "Cancelados" },
] as const;

/** Filtros de cartão olham só clientes não cancelados (cartão cancelado está fora do ar). */
export const FILTROS_ADICIONAIS = [
  { valor: "alteracoes_nao_publicadas", rotulo: "Alterações não publicadas" },
  { valor: "nunca_publicados", rotulo: "Nunca publicados" },
  { valor: "atualizados", rotulo: "Cartão atualizado" },
  { valor: "suporte_aberto", rotulo: "Com suporte aberto" },
  { valor: "elegiveis_exclusao", rotulo: "Elegíveis para exclusão" },
] as const;

export type FiltroAdmin =
  | (typeof FILTROS_PRINCIPAIS)[number]["valor"]
  | (typeof FILTROS_ADICIONAIS)[number]["valor"];

const VALIDOS = new Set<string>([...FILTROS_PRINCIPAIS, ...FILTROS_ADICIONAIS].map((f) => f.valor));

/** Valor da URL → filtro conhecido (qualquer outra coisa vira "todos"). */
export function lerFiltro(valor: unknown): FiltroAdmin {
  return typeof valor === "string" && VALIDOS.has(valor) ? (valor as FiltroAdmin) : "todos";
}

export function rotuloDoFiltro(filtro: FiltroAdmin): string {
  return [...FILTROS_PRINCIPAIS, ...FILTROS_ADICIONAIS].find((f) => f.valor === filtro)?.rotulo ?? "Todos";
}
