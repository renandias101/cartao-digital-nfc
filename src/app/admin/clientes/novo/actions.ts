"use server";

import { redirect } from "next/navigation";

import { criarCliente } from "@/lib/admin/create-client";

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
  const templateId = String(formData.get("template_id") ?? "") || undefined;
  const duplicateFromUsername = String(formData.get("duplicate_from") ?? "") || undefined;

  const resultado = await criarCliente({
    username,
    fullName,
    packageMonths,
    password,
    templateId,
    duplicateFromUsername,
  });
  if (!resultado.ok) {
    return { error: resultado.mensagem };
  }

  redirect(`/admin/clientes/${resultado.username}`);
}
