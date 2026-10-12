"use server";

import { redirect } from "next/navigation";

import { criarCliente } from "@/lib/admin/create-client";
import { lerPagamento } from "@/lib/admin/payments";
import { DEFAULT_TEMPLATE_USERNAME } from "@/lib/constants";

export type CriarClienteState = { error: string | null };

export async function criarClienteAction(
  _estadoAnterior: CriarClienteState,
  formData: FormData,
): Promise<CriarClienteState> {
  const username = String(formData.get("username") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  const packageMonths = Number(formData.get("package_months"));
  const password = String(formData.get("password") ?? "");
  // "" (nenhuma opção marcada) vira undefined — sem isso, criarCliente()
  // tentaria resolver um modelo/cliente-origem vazio como se fosse um erro.
  const origemAparencia = String(formData.get("origem_aparencia") ?? "zero");
  if (!(["zero", "modelo", "duplicar"] as const).includes(origemAparencia as "zero" | "modelo" | "duplicar")) {
    return { error: "Origem da aparência inválida." };
  }
  const selecionado = String(formData.get("duplicate_from") ?? "").trim();
  if (origemAparencia === "duplicar" && !selecionado) {
    return { error: "Selecione o cartão cuja aparência será duplicada." };
  }
  const duplicateFromUsername = origemAparencia === "modelo"
    ? DEFAULT_TEMPLATE_USERNAME
    : origemAparencia === "duplicar" ? selecionado : undefined;
  const pagamento = lerPagamento(formData);
  if (!pagamento.ok) return { error: pagamento.mensagem };

  const resultado = await criarCliente({
    username,
    fullName,
    packageMonths,
    password,
    duplicateFromUsername,
    payment: pagamento.valor,
  });
  if (!resultado.ok) {
    return { error: resultado.mensagem };
  }

  redirect(`/admin/clientes/${resultado.username}`);
}
