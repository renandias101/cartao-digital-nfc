import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Cliente Supabase com a chave secreta. IGNORA RLS por completo.
 *
 * `server-only` faz o build falhar se código de cliente alcançar este módulo
 * (mesma barreira de `env.server.ts`, testada na etapa 2).
 *
 * Uso restrito a operações que o modelo de RLS não cobre por natureza:
 *  - resolver username -> e-mail sintético antes de existir sessão (login);
 *  - ler/escrever `private.login_throttle` (bloqueio por tentativas);
 *  - criar/banir usuário via API admin do Auth.
 *
 * Nunca usar para consultar dado de cliente em nome de outro cliente. Se uma
 * tela precisa disso, o problema é a política de RLS, não este cliente.
 *
 * Não é singleton: cada import cria uma instância nova, deliberadamente —
 * evita reaproveitar estado entre requisições, mesmo não havendo cookie aqui.
 */
export function createSupabaseAdminClient() {
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
