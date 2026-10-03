import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

/**
 * Cliente Supabase para o navegador.
 *
 * Não configuramos `cookies`: a própria biblioteca cuida disso e a
 * documentação recomenda não customizar. A sessão é persistida em cookie para
 * que o servidor consiga lê-la na mesma requisição.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}
