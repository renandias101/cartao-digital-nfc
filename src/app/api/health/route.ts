import { createSupabaseAnonClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
};

/** Verificação mínima para monitoramento: aplicação + leitura pública do banco. */
export async function GET() {
  try {
    const supabase = createSupabaseAnonClient();
    const { error } = await supabase.rpc("get_card_footer");
    if (error) return new Response(JSON.stringify({ status: "unavailable" }), { status: 503, headers });
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ status: "unavailable" }), { status: 503, headers });
  }
}
