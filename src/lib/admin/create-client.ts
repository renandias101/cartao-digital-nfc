import "server-only";

import { construirEmailSintetico } from "@/lib/auth/email";
import { SENHA_MINIMA } from "@/lib/auth/constants";
import { getActor } from "@/lib/auth/session";
import type { CardContent } from "@/lib/card/types";
import { aplicarModelo, buscarModelo, duplicarConteudoSemDadosPessoais } from "@/lib/card/templates";
import { LIMITES_TEXTO, USERNAME } from "@/lib/constants";
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
  /** PRD §54: um dos presets de `CARD_TEMPLATES`. Ignorado se `duplicateFromUsername` também vier. */
  templateId?: string;
  /** PRD §55: reaproveita a aparência de um cliente existente — nunca o dado pessoal dele. */
  duplicateFromUsername?: string;
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
  const [{ data: existente }, { data: reservado }] = await Promise.all([
    admin.from("clients").select("username").eq("username", username).maybeSingle(),
    admin.from("reserved_usernames").select("username").eq("username", username).maybeSingle(),
  ]);
  if (existente || reservado) {
    return { ok: false, mensagem: "Este nome de usuário já está em uso." };
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
  } else if (input.templateId) {
    const modelo = buscarModelo(input.templateId);
    if (!modelo) {
      return { ok: false, mensagem: "Modelo não encontrado." };
    }
    conteudoInicial = aplicarModelo(modelo);
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

  const { error: erroInsercao } = await admin.from("clients").insert({
    id: userId,
    username,
    full_name: fullName,
    package_months: input.packageMonths,
    expires_at: expiresAt,
  });

  if (erroInsercao) {
    // Desfaz a criação no Auth para não deixar conta órfã sem cliente
    // correspondente (Padroes-de-Qualidade 9: evitar inconsistência de dados).
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, mensagem: "Não foi possível salvar o cliente. Tente novamente." };
  }

  // Rascunho inicial (etapa 7): nome e cores pré-preenchidos, para o cliente
  // não abrir o editor num cartão totalmente em branco. Ainda passível de
  // alteração total — nada aqui é definitivo, e nada disto é publicado
  // sozinho (publicar exige uma ação explícita do cliente, PRD §17).
  const { error: erroRascunho } = await admin.from("card_drafts").insert({
    client_id: userId,
    // `displayName` é sempre o nome do cliente NOVO — nunca herdado de
    // modelo ou duplicação, mesmo que `conteudoInicial` viesse de outro
    // cliente (PRD §55: nome é dado pessoal, nunca copiado).
    content: { ...conteudoInicial, displayName: fullName },
  });

  if (erroRascunho) {
    await admin.from("clients").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, mensagem: "Não foi possível preparar o cartão. Tente novamente." };
  }

  await admin.from("admin_audit_log").insert({
    action: "client_created",
    client_id: userId,
    client_username: username,
    client_full_name: fullName,
    actor_id: actor.userId,
    detail: { package_months: input.packageMonths, expires_at: expiresAt },
  });

  return { ok: true, username };
}
