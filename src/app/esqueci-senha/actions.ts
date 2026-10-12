"use server";

import { headers } from "next/headers";

import { requestPasswordReset } from "@/lib/auth/password-recovery";

export type ForgotPasswordState = { ok: boolean | null; message: string | null };

export async function forgotPasswordAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const requestHeaders = await headers();
  // Na Vercel, este cabeçalho preserva o IP calculado pela plataforma mesmo
  // quando existe um proxy na frente. Fora dela, os fallbacks permitem o uso
  // local e em outros provedores; o limite por usuário continua valendo.
  const source = requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
  return requestPasswordReset(String(formData.get("username") ?? ""), source);
}
