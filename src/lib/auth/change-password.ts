import "server-only";

import { SENHA_MINIMA } from "@/lib/auth/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResultadoTrocaSenha = { ok: true } | { ok: false; mensagem: string };

/** Motivos que o Supabase informa ao recusar a nova senha, em linguagem do cliente. */
function mensagemDoErroDeTroca(codigo: string | undefined, detalhe: string): string {
  switch (codigo) {
    case "same_password":
      return "A nova senha precisa ser diferente da senha atual.";
    case "weak_password":
      return "Essa senha é considerada fraca ou já apareceu em vazamentos. Escolha outra, com letras, números e símbolos.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    case "reauthentication_needed":
    case "session_expired":
    case "session_not_found":
      return "Sessão expirada. Faça login novamente.";
    default: {
      // Descrição do próprio Supabase (não contém a senha), para o cliente poder informar o motivo.
      const motivo = [detalhe, codigo ? `código: ${codigo}` : ""].filter(Boolean).join(" — ");
      return `Não foi possível trocar a senha${motivo ? `: ${motivo}` : ""}. Tente novamente.`;
    }
  }
}

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
    // Só o código e o status — nunca a senha. Sem isso a causa real some.
    console.error("[trocarSenha] updateUser falhou:", erroTroca.code ?? erroTroca.name, erroTroca.status);
    return { ok: false, mensagem: mensagemDoErroDeTroca(erroTroca.code, erroTroca.message) };
  }

  return { ok: true };
}
