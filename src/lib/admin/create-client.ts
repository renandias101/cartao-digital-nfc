import "server-only";

import { construirEmailSintetico } from "@/lib/auth/email";
import { SENHA_MINIMA } from "@/lib/auth/constants";
import { getActor } from "@/lib/auth/session";
import type { CardContent } from "@/lib/card/types";
import { duplicarConteudoSemDadosPessoais } from "@/lib/card/templates";
import { LIMITES_TEXTO, USERNAME } from "@/lib/constants";
import type { DadosPagamento } from "@/lib/admin/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ResultadoCriarCliente =
  | { ok: true; username: string }
  | { ok: false; mensagem: string };

/**
 * Cadastra um novo cliente (PRD §60).
 *
 * Usa o cliente de SERVIÇO do início ao fim — criar o usuário no Auth exige
 * a API admin, que só a chave secreta alcança, então não há ganho em trocar
 * de cliente no meio do caminho. Por bypassar RLS por completo, o portão de
 * autorização mora aqui mesmo, explícito: sem isso, qualquer chamador
 * conseguiria criar contas.
 */
export async function criarCliente(input: {
  username: string;
  fullName: string;
  packageMonths: number;
  password: string;
  /** PRD §55: reaproveita a aparência de um cliente existente — nunca o dado pessoal dele. */
  duplicateFromUsername?: string;
  payment: DadosPagamento;
}): Promise<ResultadoCriarCliente> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) {
    return { ok: false, mensagem: "Não autorizado." };
  }

  const username = input.username.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (!USERNAME.padrao.test(username) || username.length < USERNAME.minimo || username.length > USERNAME.maximo) {
    return { ok: false, mensagem: "Nome de usuário inválido." };
  }
  if (fullName.length < 2 || fullName.length > LIMITES_TEXTO.nomeExibido) {
    return { ok: false, mensagem: "Nome inválido." };
  }
  if (![3, 6, 12].includes(input.packageMonths)) {
    return { ok: false, mensagem: "Pacote inválido. Use 3, 6 ou 12 meses." };
  }
  if (input.password.length < SENHA_MINIMA) {
    return { ok: false, mensagem: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  }

  const admin = createSupabaseAdminClient();

  // Checagem de disponibilidade (PRD §6). A UNIQUE constraint e o gatilho de
  // reservados no banco são a garantia final — isto é só para devolver uma
  // mensagem clara em vez de um erro de constraint.
  const [{ data: existente }, { data: reservado }, { data: alias }] = await Promise.all([
    admin.from("clients").select("username").eq("username", username).maybeSingle(),
    admin.from("reserved_usernames").select("username").eq("username", username).maybeSingle(),
    admin.from("client_username_aliases").select("alias").eq("alias", username).maybeSingle(),
  ]);
  if (existente || reservado || alias) {
    return { ok: false, mensagem: "Este nome de usuário já está ou esteve em uso, ou é reservado." };
  }

  // Resolve a aparência inicial ANTES de criar a conta no Auth — se a fonte
  // de duplicação não existir, falha aqui, sem deixar usuário órfão para
  // desfazer depois.
  let conteudoInicial: Omit<CardContent, "displayName"> = {
    buttons: [],
    backgroundColor: "#ffffff",
    buttonColor: "#000000",
  };

  if (input.duplicateFromUsername) {
    const origemUsername = input.duplicateFromUsername.trim().toLowerCase();
    const origem = await admin
      .from("clients")
      .select("id")
      .eq("username", origemUsername)
      .maybeSingle();
    if (!origem.data) {
      return { ok: false, mensagem: "Cliente de origem para duplicar não foi encontrado." };
    }
    const [publicado, rascunho] = await Promise.all([
      admin.from("card_published").select("content").eq("client_id", origem.data.id).maybeSingle(),
      admin.from("card_drafts").select("content").eq("client_id", origem.data.id).maybeSingle(),
    ]);
    const conteudoOrigem = (publicado.data?.content ?? rascunho.data?.content) as
      | CardContent
      | undefined;
    if (!conteudoOrigem) {
      return { ok: false, mensagem: "O cliente de origem não tem cartão configurado para duplicar." };
    }
    conteudoInicial = duplicarConteudoSemDadosPessoais(conteudoOrigem);
  }

  const email = construirEmailSintetico(username);
  const { data: novoUsuario, error: erroCriacao } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (erroCriacao || !novoUsuario.user) {
    return { ok: false, mensagem: "Não foi possível criar a conta. Tente novamente." };
  }

  const userId = novoUsuario.user.id;

  // `compute_new_expiry` devolve um escalar (timestamptz), não um conjunto de
  // linhas — sem `.single()`/`.maybeSingle()`, que são para reduzir um
  // array de linhas a uma, não para isto.
  const { data: expiresAt, error: erroData } = await admin.rpc("compute_new_expiry", {
    p_current_expires_at: new Date().toISOString(),
    p_current_cancelled_at: null,
    p_package_months: input.packageMonths,
  });

  if (erroData || !expiresAt) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, mensagem: "Não foi possível calcular o vencimento. Tente novamente." };
  }

  const { error: erroInsercao } = await admin.rpc("admin_create_client_record", {
    p_client_id: userId,
    p_username: username,
    p_full_name: fullName,
    p_package_months: input.packageMonths,
    p_expires_at: expiresAt,
    // O nome pertence sempre ao novo cliente; modelos nunca carregam dados pessoais.
    p_content: { ...conteudoInicial, displayName: fullName },
    p_actor_id: actor.userId,
    p_amount_cents: input.payment.amountCents,
    p_method: input.payment.method,
    p_paid_on: input.payment.paidOn,
    p_note: input.payment.note,
  });

  if (erroInsercao) {
    const { error: erroDesfazerAuth } = await admin.auth.admin.deleteUser(userId);
    if (erroDesfazerAuth) {
      console.error("Criação de cliente falhou no banco e a conta de Auth órfã não pôde ser removida.");
      return { ok: false, mensagem: "Não foi possível salvar o cliente e a conta de acesso precisa de revisão no Supabase." };
    }
    return { ok: false, mensagem: "Não foi possível salvar o cliente. Nenhum dado foi gravado; tente novamente." };
  }

  return { ok: true, username };
}
