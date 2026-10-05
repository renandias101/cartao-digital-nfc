/**
 * Formatação de datas e valores do painel. Fuso fixo de Belém (UTC-3, o do
 * negócio): o servidor roda em UTC e sem isso a data "pularia" de dia.
 */
const FUSO = "America/Belem";

/** 04/10/2026 */
export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO });
}

/** 04/10/2026 às 18:32 */
export function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { timeZone: FUSO });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

/** R$ 120,00 a partir de centavos. */
export function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "1 dia" / "3 dias" */
export function dias(n: number): string {
  return `${n} dia${n === 1 ? "" : "s"}`;
}

/** Dias inteiros de agora até `iso` (negativo se já passou). */
export function diasAte(iso: string, agora: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - agora.getTime()) / 86_400_000);
}
