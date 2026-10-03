import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Encerra a sessão atual (PRD §44). */
export async function encerrarSessao(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
