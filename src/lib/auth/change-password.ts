import "server-only";

import { SENHA_MINIMA } from "@/lib/auth/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResultadoTrocaSenha = { ok: true } | { ok: false; mensagem: string };

/**
 * Cliente troca a própria senha, já logado (PRD §4).
 *
 * Exige a senha atual antes de trocar. O PRD não pede isso explicitamente,
 * mas sem essa checagem qualquer sessão aberta e esquecida (computador
 * compartilhado, por exemplo) poderia ter a senha trocada por outra pessoa
 * sem saber a senha original — a troca por si só não usa nem confirma a
 * identidade de quem está de fato sentado ali.
 */
export async function trocarSenha(
  senhaAtual: string,
  senhaNova: string,
): Promise<ResultadoTrocaSenha> {
  if (senhaNova.length < SENHA_MINIMA) {
    return { ok: false, mensagem: `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  }

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.email) {
    return { ok: false, mensagem: "Sessão expirada. Faça login novamente." };
  }

  const { error: erroReautenticacao } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: senhaAtual,
  });
  if (erroReautenticacao) {
    return { ok: false, mensagem: "Senha atual incorreta." };
  }

  const { error: erroTroca } = await supabase.auth.updateUser({ password: senhaNova });
  if (erroTroca) {
    return { ok: false, mensagem: "Não foi possível trocar a senha. Tente novamente." };
  }

  return { ok: true };
}
