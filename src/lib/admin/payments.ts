/**
 * Registro (opcional) de pagamento ao renovar — regras iguais aos `check` de
 * `client_payments` (migration 20261004180000). Sem campo preenchido, a
 * renovação acontece sem registro de pagamento.
 */
export const FORMAS_PAGAMENTO = [
  { valor: "pix", rotulo: "PIX" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "cartao", rotulo: "Cartão" },
  { valor: "outro", rotulo: "Outro" },
] as const;

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]["valor"];

export function rotuloFormaPagamento(forma: string | null): string {
  return FORMAS_PAGAMENTO.find((f) => f.valor === forma)?.rotulo ?? "—";
}

/** "120", "120,5", "1.200,00", "R$ 99,90" → centavos. null se vazio; "invalido" se não for valor. */
export function lerValorEmCentavos(texto: string): number | null | "invalido" {
  const limpo = texto.replace(/R\$|\s/g, "");
  if (!limpo) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return "invalido";
  const [reais, centavos = "0"] = limpo.replace(/\./g, "").split(",");
  const total = Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
  return total <= 100_000_000 ? total : "invalido";
}

export type DadosPagamento = {
  registrar: boolean;
  amountCents: number | null;
  method: FormaPagamento | null;
  paidOn: string | null;
  note: string | null;
};

/** Lê e valida os campos de pagamento do formulário de renovação. */
export function lerPagamento(
  form: FormData,
): { ok: true; valor: DadosPagamento } | { ok: false; mensagem: string } {
  const valor = lerValorEmCentavos(String(form.get("amount") ?? ""));
  if (valor === "invalido") return { ok: false, mensagem: "Valor inválido. Use, por exemplo, 120,00." };

  const metodoBruto = String(form.get("method") ?? "");
  const method = FORMAS_PAGAMENTO.some((f) => f.valor === metodoBruto) ? (metodoBruto as FormaPagamento) : null;
  if (metodoBruto && !method) return { ok: false, mensagem: "Forma de pagamento inválida." };

  const dataBruta = String(form.get("paid_on") ?? "");
  if (dataBruta && !/^\d{4}-\d{2}-\d{2}$/.test(dataBruta)) return { ok: false, mensagem: "Data do pagamento inválida." };

  const note = String(form.get("payment_note") ?? "").trim() || null;
  if (note && note.length > 500) return { ok: false, mensagem: "Observação do pagamento: máximo de 500 caracteres." };

  const registrar = valor !== null || method !== null || note !== null;
  return {
    ok: true,
    valor: { registrar, amountCents: valor, method, paidOn: registrar ? dataBruta || null : null, note },
  };
}
