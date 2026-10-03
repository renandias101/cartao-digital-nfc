import "server-only";

import { LOGIN_THROTTLE } from "@/lib/auth/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Mensagem única para credencial errada, conta inexistente ou banida pelo Auth. */
const CREDENCIAIS_INVALIDAS = "Usuário ou senha inválidos.";
/** Mensagem específica só para o bloqueio do próprio throttle — não confirma se a conta existe. */
const MUITAS_TENTATIVAS = "Muitas tentativas. Tente novamente em alguns minutos.";

const LIMITE_USERNAME = 64;
const LIMITE_SENHA = 200;

export type ResultadoLogin =
  | { ok: true; isAdmin: boolean }
  | { ok: false; mensagem: string };

/**
 * Tenta autenticar por nome de usuário e senha (PRD §4).
 *
 * Duas chamadas ao Supabase com propósitos diferentes:
 *  - o cliente de SERVIÇO resolve identidade e opera o bloqueio por
 *    tentativas — essas tabelas não têm política de RLS para ninguém além
 *    de `service_role`, então precisam dessa chave;
 *  - o cliente de SERVIDOR (chave publicável + cookies) autentica de fato,
 *    porque é o único que grava a sessão no cookie da resposta.
 *
 * Todo caminho de falha devolve uma de duas mensagens fixas. Nunca revela se
 * o username existe, se é cliente ou admin, ou o motivo exato da recusa.
 */
export async function tentarLogin(
  usernameInformado: string,
  senha: string,
): Promise<ResultadoLogin> {
  const username = usernameInformado.trim().toLowerCase();

  if (!username || !senha || username.length > LIMITE_USERNAME || senha.length > LIMITE_SENHA) {
    return { ok: false, mensagem: CREDENCIAIS_INVALIDAS };
  }

  const admin = createSupabaseAdminClient();

  const { data: bloqueio } = await admin.rpc("check_login_lock", {
    p_username: username,
  });
  if (bloqueio) {
    return { ok: false, mensagem: MUITAS_TENTATIVAS };
  }

  const { data: identidade } = await admin
    .rpc("resolve_login_identity", { p_username: username })
    .maybeSingle()
    // O projeto ainda não gera tipos do banco (`supabase gen types`); este é
    // o mecanismo oficial da biblioteca para descrever o formato de uma RPC
    // sem isso — documentado no próprio arquivo de tipos do postgrest-js.
    // `.overrideTypes()` vem DEPOIS de `.maybeSingle()`: descreve a linha já
    // reduzida (objeto), não o array anterior — inverter dá erro de tipo.
    .overrideTypes<{ user_id: string; email: string }>();

  if (!identidade) {
    // Username não existe. Ainda assim registra a falha, para que testar
    // nomes ao acaso também fique sujeito ao mesmo bloqueio.
    await admin.rpc("register_login_failure", {
      p_username: username,
      p_max_attempts: LOGIN_THROTTLE.maxTentativas,
      p_lock_minutes: LOGIN_THROTTLE.bloqueioMinutos,
    });
    return { ok: false, mensagem: CREDENCIAIS_INVALIDAS };
  }

  const supabase = await createSupabaseServerClient();
  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: identidade.email,
    password: senha,
  });

  if (erroLogin) {
    const { data: falha } = await admin
      .rpc("register_login_failure", {
        p_username: username,
        p_max_attempts: LOGIN_THROTTLE.maxTentativas,
        p_lock_minutes: LOGIN_THROTTLE.bloqueioMinutos,
      })
      .maybeSingle()
      .overrideTypes<{ failed_count: number; locked_until: string | null }>();

    // Bloqueio reforçado na própria conta: mesmo que alguém chame a API do
    // Supabase direto, ignorando esta Server Action, a conta segue banida.
    if (falha?.locked_until) {
      await admin.auth.admin.updateUserById(identidade.user_id, {
        ban_duration: `${LOGIN_THROTTLE.bloqueioMinutos}m`,
      });
    }

    return { ok: false, mensagem: CREDENCIAIS_INVALIDAS };
  }

  await admin.rpc("register_login_success", { p_username: username });

  const { data: isAdmin } = await supabase.rpc("am_i_admin");
  return { ok: true, isAdmin: Boolean(isAdmin) };
}
