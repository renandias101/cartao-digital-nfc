import { DOMINIO_EMAIL_SINTETICO } from "@/lib/auth/constants";

/**
 * Constrói o e-mail sintético a partir de um nome de usuário.
 *
 * Espelha exatamente `lower(username) || '@internal.cartao.local'` de
 * `private.resolve_login_email` no banco. As duas cópias existem porque a
 * criação do usuário (`auth.admin.createUser`) precisa montar o e-mail antes
 * de qualquer linha existir para consultar — não há o que resolver ainda.
 *
 * Se um dia divergir do SQL, `supabase/tests/rls.test.mjs` (seção de paridade)
 * pega a divergência.
 */
export function construirEmailSintetico(username: string): string {
  return `${username.trim().toLowerCase()}@${DOMINIO_EMAIL_SINTETICO}`;
}
