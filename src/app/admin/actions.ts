"use server";

import { redirect } from "next/navigation";

import { encerrarSessao } from "@/lib/auth/logout";

export async function logoutAction(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
