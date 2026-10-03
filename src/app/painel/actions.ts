"use server";

import { redirect } from "next/navigation";

import { trocarSenha, type ResultadoTrocaSenha } from "@/lib/auth/change-password";
import { encerrarSessao } from "@/lib/auth/logout";

export async function logoutAction(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}

export type ChangePasswordState = ResultadoTrocaSenha | { ok: null };

export async function changePasswordAction(
  _estadoAnterior: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const senhaAtual = String(formData.get("current_password") ?? "");
  const senhaNova = String(formData.get("new_password") ?? "");
  return trocarSenha(senhaAtual, senhaNova);
}
