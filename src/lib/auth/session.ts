import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Actor =
  | { logado: false }
  | { logado: true; userId: string; isAdmin: true }
  | { logado: true; userId: string; isAdmin: false };

/**
 * Identifica quem está logado nesta requisição, e se é o administrador.
 *
 * Usa `getUser()`, que valida o JWT contra o servidor do Auth, nunca o
 * conteúdo do cookie por si só (a biblioteca avisa: sem essa validação, o
 * valor "não deve ser confiado" — é exatamente o tipo de atalho que o §42
 * proíbe).
 *
 * `isAdmin` vem de `public.am_i_admin()`, que por sua vez consulta
 * `private.admins` com `security definer`. Nunca de `user_metadata` ou
 * `app_metadata` do JWT — o primeiro é editável pelo próprio usuário, e nada
 * aqui precisa da complexidade de gerenciar o segundo.
 *
 * Esta função é conveniência para montar a interface (qual painel mostrar).
 * Ela NÃO substitui a checagem de propriedade em cada Server Action — essa
 * responsabilidade é do RLS e de cada action, como registrado em D7.
 */
export async function getActor(): Promise<Actor> {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { logado: false };
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("am_i_admin");
  if (adminError) {
    // Falha ao verificar admin não deve, por padrão, conceder privilégio.
    // Trata como cliente comum; cada tela protegida de admin confere de novo.
    return { logado: true, userId: userData.user.id, isAdmin: false };
  }

  return { logado: true, userId: userData.user.id, isAdmin: Boolean(isAdmin) };
}
