import "server-only";

import { emailValido, normalizarWhatsapp } from "@/lib/admin/contacts";
import type { FiltroAdmin } from "@/lib/admin/filters";
import type { FormaPagamento } from "@/lib/admin/payments";
import type { CardContent } from "@/lib/card/types";
import { getActor } from "@/lib/auth/session";
import { USERNAME } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Leitura e escrita administrativas dos clientes. Usa o cliente de SESSÃO
 * (cookies do admin): quem autoriza é a RLS — só o administrador enxerga e
 * altera as linhas dos outros clientes (D26). As páginas conferem
 * `getActor().isAdmin` para decidir o que mostrar.
 *
 * Nota sobre os `as`: o projeto ainda não gera tipos do banco
 * (`supabase gen types`); cada formato abaixo é o que a migration
 * correspondente realmente devolve.
 */

export type StatusCliente = "active" | "expired" | "cancelled";

/** Estado do cartão: compara o conteúdo do rascunho com o publicado. */
export type EstadoCartao = "never_published" | "pending_changes" | "up_to_date";

/** Linha de `admin_client_overview` (migration 20261004200000). */
export type ClienteOperacional = {
  id: string;
  username: string;
  full_name: string;
  package_months: number;
  expires_at: string;
  cancelled_at: string | null;
  last_renewed_at: string | null;
  created_at: string;
  status: StatusCliente;
  days_until_expiry: number;
  /** Data do cancelamento (manual ou automático); null se não cancelado. */
  cancelled_on: string | null;
  /** A partir de quando pode ser excluído; null se não cancelado. */
  deletion_eligible_at: string | null;
  draft_updated_at: string | null;
  published_at: string | null;
  card_state: EstadoCartao;
  open_support_count: number;
};

const POR_PAGINA = 20;

export type ClienteParaDuplicacao = { id: string; username: string; full_name: string };

/** Todos os clientes disponíveis como fonte visual, sem depender do limite padrão da API. */
export async function listarClientesParaDuplicacao(): Promise<ClienteParaDuplicacao[]> {
  const supabase = await createSupabaseServerClient();
  const resultado: ClienteParaDuplicacao[] = [];
  const lote = 200;
  for (let inicio = 0; ; inicio += lote) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, username, full_name")
      .order("full_name", { ascending: true })
      .order("username", { ascending: true })
      .range(inicio, inicio + lote - 1);
    if (error) throw new Error(`Não foi possível carregar os cartões para duplicação: ${error.message}`);
    const pagina = (data ?? []) as ClienteParaDuplicacao[];
    resultado.push(...pagina);
    if (pagina.length < lote) return resultado;
  }
}

/** Lista paginada com filtro e busca (nome, usuário, WhatsApp e e-mail internos). */
export async function listarClientes(opcoes: {
  filtro: FiltroAdmin;
  busca: string;
  pagina: number;
}): Promise<{ clientes: ClienteOperacional[]; total: number; totalPaginas: number }> {
  const supabase = await createSupabaseServerClient();
  const pagina = Math.max(1, opcoes.pagina);
  const termo = opcoes.busca.trim() || null;
  const [{ data, error }, contagem] = await Promise.all([
    supabase.rpc("admin_list_clients", {
      p_filter: opcoes.filtro,
      p_term: termo,
      p_limit: POR_PAGINA,
      p_offset: (pagina - 1) * POR_PAGINA,
    }),
    // Usa a RPC já presente no banco remoto. Consultar a primeira linha
    // preserva o total mesmo quando a página solicitada ficou vazia.
    supabase.rpc("admin_list_clients", {
      p_filter: opcoes.filtro,
      p_term: termo,
      p_limit: 1,
      p_offset: 0,
    }),
  ]);
  if (error || contagem.error) {
    throw new Error(`Não foi possível carregar a lista de clientes: ${(error ?? contagem.error)?.message ?? "erro desconhecido"}`);
  }
  const linhas = (data ?? []) as (ClienteOperacional & { total_count: number })[];
  const linhasContagem = (contagem.data ?? []) as Array<{ total_count: number }>;
  const total = Number(linhasContagem[0]?.total_count ?? 0);
  return {
    clientes: linhas.map(({ total_count: _total, ...c }) => c),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  };
}

export type ContagensDeAtencao = {
  ativos: number;
  vence_em_15_dias: number;
  vencidos: number;
  cancelados: number;
  alteracoes_nao_publicadas: number;
  nunca_publicados: number;
  elegiveis_exclusao: number;
  suporte_aberto: number;
};

/** "O que precisa da minha atenção hoje?" — uma consulta, mesmos critérios dos filtros. */
export async function contarAtencao(): Promise<ContagensDeAtencao | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_attention_counts");
  const linha = Array.isArray(data) ? data[0] : null;
  if (error || !linha) return null;
  return Object.fromEntries(Object.entries(linha).map(([k, v]) => [k, Number(v)])) as ContagensDeAtencao;
}

/** Ficha do cliente pelo nome de usuário. */
export async function buscarClientePorUsername(username: string): Promise<ClienteOperacional | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_client_overview")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) {
    throw new Error(`Não foi possível carregar o cliente: ${error.message}`);
  }
  return data as ClienteOperacional | null;
}

/** Conteúdo do rascunho e da versão publicada (null se nunca publicou). */
export async function buscarConteudosDoCartao(
  clientId: string,
): Promise<{ rascunho: CardContent | null; publicado: CardContent | null }> {
  const supabase = await createSupabaseServerClient();
  const [rascunho, publicado] = await Promise.all([
    supabase.from("card_drafts").select("content").eq("client_id", clientId).maybeSingle(),
    supabase.from("card_published").select("content").eq("client_id", clientId).maybeSingle(),
  ]);
  if (rascunho.error || publicado.error) {
    throw new Error("Não foi possível carregar as versões do cartão.");
  }
  return {
    rascunho: (rascunho.data?.content as CardContent | undefined) ?? null,
    publicado: (publicado.data?.content as CardContent | undefined) ?? null,
  };
}

/** Observações internas de um cliente (PRD §39). Nunca visível ao cliente. */
export async function buscarObservacoes(clientId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_notes")
    .select("notes")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    throw new Error(`Não foi possível carregar as observações: ${error.message}`);
  }
  return data?.notes ?? "";
}

/** Salva observações internas (PRD §39); a política `client_notes_admin_all` exige admin. */
export async function salvarObservacoes(clientId: string, _username: string, notes: string): Promise<void> {
  if (notes.length > 2000) throw new Error("As observações podem ter no máximo 2000 caracteres.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_save_client_notes", { p_client_id: clientId, p_notes: notes });
  if (error) {
    throw new Error(`Não foi possível salvar as observações: ${error.message}`);
  }
}

/** Ações administrativas envolvendo este cliente, mais recentes primeiro (PRD §40). */
export async function historicoDoCliente(clientId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("action, detail, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(`Não foi possível carregar o histórico: ${error.message}`);
  }
  return data ?? [];
}

type Resultado = { ok: true } | { ok: false; mensagem: string };

export type ResultadoAlterarUsername =
  | { ok: true; username: string }
  | { ok: false; mensagem: string };

/** Altera a URL somente para admin; o banco repete a autorização e faz tudo atomicamente. */
export async function alterarUsernameCliente(
  clientId: string,
  usernameAtual: string,
  novoUsernameInformado: string,
): Promise<ResultadoAlterarUsername> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) return { ok: false, mensagem: "Não autorizado." };

  const novoUsername = novoUsernameInformado.trim().toLowerCase();
  if (!USERNAME.padrao.test(novoUsername)
      || novoUsername.length < USERNAME.minimo
      || novoUsername.length > USERNAME.maximo) {
    return { ok: false, mensagem: "Nome de usuário inválido. Use de 3 a 32 letras minúsculas, números ou hífens." };
  }
  if (novoUsername === usernameAtual.toLowerCase()) {
    return { ok: false, mensagem: "Informe um nome de usuário diferente do atual." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_change_client_username", {
    p_client_id: clientId,
    p_new_username: novoUsername,
  });
  if (error) {
    const indisponivel = error.code === "23505" || /indisponivel|reservado/i.test(error.message);
    return {
      ok: false,
      mensagem: indisponivel
        ? "Este nome de usuário já está ou esteve em uso, ou é reservado. Escolha outro."
        : "Não foi possível alterar o endereço. Nenhuma mudança foi salva; tente novamente.",
    };
  }
  return { ok: true, username: novoUsername };
}

/**
 * Corrige o nome do cliente (uso interno). O nome de usuário — e com ele a
 * URL do NFC — nunca muda por aqui (regra 1).
 */
export type ContatosAdministrativos = { whatsapp: string | null; email: string | null };

/** Contato interno do cliente (tabela só do admin; nunca no cartão). */
export async function buscarContatos(clientId: string): Promise<ContatosAdministrativos> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_admin_contacts")
    .select("whatsapp, email")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar os contatos: ${error.message}`);
  return { whatsapp: data?.whatsapp ?? null, email: data?.email ?? null };
}

export async function salvarDadosCliente(
  clientId: string,
  entrada: { fullName: string; whatsapp: string; email: string },
): Promise<Resultado> {
  const nome = entrada.fullName.trim();
  if (nome.length < 2 || nome.length > 120) {
    return { ok: false, mensagem: "Informe um nome de 2 a 120 caracteres." };
  }
  const whatsapp = normalizarWhatsapp(entrada.whatsapp);
  if (whatsapp === "invalido") {
    return { ok: false, mensagem: "WhatsApp inválido. Use DDD e número, por exemplo (96) 98123-3398." };
  }
  const email = entrada.email.trim().toLowerCase() || null;
  if (email && !emailValido(email)) {
    return { ok: false, mensagem: "E-mail inválido." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_client_data", {
    p_client_id: clientId,
    p_full_name: nome,
    p_whatsapp: whatsapp,
    p_email: email,
  });
  if (error) {
    return { ok: false, mensagem: "Não foi possível salvar o contato. Tente novamente." };
  }
  return { ok: true };
}


export type Pagamento = {
  id: number;
  months: number;
  amount_cents: number | null;
  method: FormaPagamento | null;
  paid_on: string;
  note: string | null;
};

/** Pagamentos registrados nas renovações, mais recentes primeiro. */
export async function listarPagamentos(clientId: string): Promise<Pagamento[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_payments")
    .select("id, months, amount_cents, method, paid_on, note")
    .eq("client_id", clientId)
    .order("paid_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Não foi possível carregar os pagamentos: ${error.message}`);
  return (data ?? []) as Pagamento[];
}
