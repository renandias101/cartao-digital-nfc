"use server";

import { headers } from "next/headers";

import { requestPasswordReset } from "@/lib/auth/password-recovery";

export type ForgotPasswordState = { ok: boolean | null; message: string | null };

export async function forgotPasswordAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const requestHeaders = await headers();
  const source = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
  return requestPasswordReset(String(formData.get("username") ?? ""), source);
}
