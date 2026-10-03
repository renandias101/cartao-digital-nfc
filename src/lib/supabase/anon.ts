import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";

/**
 * Cliente Supabase anônimo, sem cookies — para a página pública do cartão.
 *
 * Diferente de `createSupabaseServerClient` (que chama `cookies()` e por
 * isso torna a rota dinâmica só por existir), este cliente nunca toca
 * `cookies()`/`headers()`. Correto por dois motivos: o visitante nunca tem
 * sessão (não faz sentido ler cookie nenhum aqui), e a página do cartão é o
 * caminho de maior tráfego do sistema — aberta por NFC (PRD §52) —, então
 * evitar as APIs de requisição que forçam renderização dinâmica é ganho
 * real, não prematuro.
 */
export function createSupabaseAnonClient() {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}
