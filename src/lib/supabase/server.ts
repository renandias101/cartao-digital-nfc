import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";

/**
 * Cliente Supabase para uso no servidor — Server Components, Server Actions e
 * Route Handlers.
 *
 * Precisa ser criado a cada requisição. Reaproveitar uma instância entre
 * requisições mistura sessões de usuários diferentes.
 *
 * Usa a chave publicável, então **todas as consultas passam por RLS** — é
 * assim que o isolamento do PRD §42 é garantido no banco, não em código.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem escrever cookies. O erro é esperado e
          // ignorável: a renovação de token acontece no `proxy.ts`, que roda
          // antes da renderização e consegue escrever na resposta.
          // O `proxy.ts` entra na etapa 4 (autenticação).
        }
      },
    },
  });
}
