"use server";

import { revalidatePath } from "next/cache";

import { closePasswordResetRequest, fulfillPasswordResetRequest } from "@/lib/admin/password-reset-requests";

export type PasswordRequestActionState = { ok: boolean | null; message: string | null };

export async function fulfillPasswordRequestAction(id: number, _state: PasswordRequestActionState, formData: FormData) {
  const result = await fulfillPasswordResetRequest(id, String(formData.get("new_password") ?? ""));
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

export async function closePasswordRequestAction(id: number, _state: PasswordRequestActionState, formData: FormData) {
  const result = await closePasswordResetRequest(id, String(formData.get("reason") ?? ""));
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}
