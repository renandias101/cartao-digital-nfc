"use server";

import { redirect } from "next/navigation";

import { tentarLogin } from "@/lib/auth/login";

export type LoginState = { error: string | null };

/**
 * Server Action do formulário de login.
 *
 * A verificação de credenciais mora inteira em `tentarLogin` — esta função é
 * só a cola com `useActionState` (extrai o FormData, decide redirecionar).
 */
export async function loginAction(
  _estadoAnterior: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const resultado = await tentarLogin(username, password);
  if (!resultado.ok) {
    return { error: resultado.mensagem };
  }

  redirect(resultado.isAdmin ? "/admin" : "/painel");
}
