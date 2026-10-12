export function normalizarPagina(valor: unknown): number {
  if (typeof valor !== "string" && typeof valor !== "number") return 1;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : 1;
}

export function totalDePaginas(total: number, porPagina: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / porPagina));
}
