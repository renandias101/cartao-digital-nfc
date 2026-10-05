import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StatusCliente = "active" | "expired" | "cancelled";

export type ClienteComStatus = {
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
};

export type FiltroAdmin = "todos" | "ativos" | "vence_em_15_dias" | "vencidos" | "cancelados";

const POR_PAGINA = 20;

/**
 * Nota sobre os `as` nesta função e nas seguintes: o projeto ainda não gera
 * tipos do banco (`supabase gen types typescript`) — isso exige Docker local
 * ou credenciais que ainda não temos (etapa 17 revisita). Sem um `Database`
 * genérico no cliente, `.overrideTypes()` encadeado com `.select("*")` ou
 * com RPCs que devolvem tabela produz inferências conflitantes entre si
 * (confirmado tentando: a mesma chamada ora "assume array", ora "assume
 * single", dependendo de detalhes da chamada anterior). Um `as` direto no
 * resultado já desestruturado é menos elegante, mas previsível — e o
 * formato de cada função é o que a migration correspondente realmente
 * devolve, não uma suposição.
 */

/**
 * Lista clientes para o painel administrativo (PRD §35-§38).
 *
 * Usa o cliente de servidor comum, não o de serviço: a política de RLS já
 * garante que só o administrador enxerga todas as linhas (D26 — autorização
 * delegada ao banco, não duplicada aqui). Se um cliente comum chegar a
 * chamar isto por engano, o RLS devolve só a própria linha, nunca a lista
 * inteira — mas quem impede a tela de aparecer é a página, via `getActor()`.
 *
 * Chama `list_clients_for_admin` (RPC com parâmetros de verdade), em vez de
 * montar um filtro `.or()` por concatenação de string — o DSL de filtros do
 * PostgREST exige envolver valor com caractere especial em aspas duplas para
 * escapar, e uma implementação errada disso deixaria o termo de busca
 * alterar a estrutura do filtro, não só o valor. RPC evita o problema todo:
 * o termo é sempre parâmetro, nunca sintaxe.
 */
export async function listarClientes(opcoes: {
  filtro: FiltroAdmin;
  busca: string;
  pagina: number;
}): Promise<{ clientes: ClienteComStatus[]; total: number; totalPaginas: number }> {
  const supabase = await createSupabaseServerClient();
  const pagina = Math.max(1, opcoes.pagina);
  const offset = (pagina - 1) * POR_PAGINA;

  const status =
    opcoes.filtro === "ativos" || opcoes.filtro === "vence_em_15_dias"
      ? "active"
      : opcoes.filtro === "vencidos"
        ? "expired"
        : opcoes.filtro === "cancelados"
          ? "cancelled"
          : null;
  const maxDias = opcoes.filtro === "vence_em_15_dias" ? 15 : null;
  const busca = opcoes.busca.trim() || null;

  const { data, error } = await supabase.rpc("list_clients_for_admin", {
    p_status: status,
    p_max_days: maxDias,
    p_term: busca,
    p_limit: POR_PAGINA,
    p_offset: offset,
  });

  if (error) {
    throw new Error(`Não foi possível carregar a lista de clientes: ${error.message}`);
  }

  const linhas = (data ?? []) as (ClienteComStatus & { total_count: number })[];
  const total = linhas[0]?.total_count ?? 0;
  return {
    clientes: linhas.map(({ total_count: _total_count, ...c }) => c),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  };
}

/** Busca um cliente pelo nome de usuário, com status calculado. */
export async function buscarClientePorUsername(
  username: string,
): Promise<ClienteComStatus | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients_with_status")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o cliente: ${error.message}`);
  }
  return data as ClienteComStatus | null;
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

/**
 * Salva observações internas (PRD §39). Usa o cliente comum: a política
 * `client_notes_admin_all` já exige admin — sem checagem duplicada aqui
 * (D26). Se um cliente comum chamar isto por engano, a escrita afeta zero
 * linhas e o erro do Postgres sobe como `error` normalmente.
 */
export async function salvarObservacoes(
  clientId: string,
  username: string,
  notes: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("client_notes")
    .upsert({ client_id: clientId, notes }, { onConflict: "client_id" });

  if (error) {
    throw new Error(`Não foi possível salvar as observações: ${error.message}`);
  }

  await supabase.from("admin_audit_log").insert({
    action: "notes_updated",
    client_id: clientId,
    client_username: username,
  });
}

/** Última edição do rascunho e última publicação (PRD §41). */
export async function buscarAtividadeDoCartao(
  clientId: string,
): Promise<{ ultimaEdicao: string | null; ultimaPublicacao: string | null }> {
  const supabase = await createSupabaseServerClient();
  const [rascunho, publicado] = await Promise.all([
    supabase.from("card_drafts").select("updated_at").eq("client_id", clientId).maybeSingle(),
    supabase.from("card_published").select("published_at").eq("client_id", clientId).maybeSingle(),
  ]);

  return {
    ultimaEdicao: rascunho.data?.updated_at ?? null,
    ultimaPublicacao: publicado.data?.published_at ?? null,
  };
}

/** Últimas ações administrativas envolvendo este cliente (PRD §40). */
export async function historicoDoCliente(username: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("action, detail, created_at")
    .eq("client_username", username.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Não foi possível carregar o histórico: ${error.message}`);
  }
  return data ?? [];
}

export type ResumoClientes = {
  ativos: number;
  venceEm15Dias: number;
  vencidos: number;
  cancelados: number;
};

/** Números do topo do painel: mesmos critérios dos filtros da lista. */
export async function resumoClientes(): Promise<ResumoClientes | null> {
  const supabase = await createSupabaseServerClient();
  const contar = () => supabase.from("clients_with_status").select("id", { count: "exact", head: true });
  const [ativos, vencendo, vencidos, cancelados] = await Promise.all([
    contar().eq("status", "active"),
    contar().eq("status", "active").lte("days_until_expiry", 15),
    contar().eq("status", "expired"),
    contar().eq("status", "cancelled"),
  ]);
  if (ativos.error || vencendo.error || vencidos.error || cancelados.error) return null;
  return {
    ativos: ativos.count ?? 0,
    venceEm15Dias: vencendo.count ?? 0,
    vencidos: vencidos.count ?? 0,
    cancelados: cancelados.count ?? 0,
  };
}

/** Data da última publicação de cada cliente da página (sem linha = nunca publicou). */
export async function publicacoesDosClientes(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("card_published").select("client_id, published_at").in("client_id", ids);
  return new Map((data ?? []).map((linha) => [linha.client_id as string, linha.published_at as string]));
}

/**
 * Corrige o nome do cliente (o nome interno, usado no painel). O nome de
 * usuário — e com ele a URL do NFC — nunca muda por aqui (regra 1). A
 * política `clients_update_admin` garante que só o administrador altera.
 */
export async function atualizarNomeCliente(
  clientId: string,
  username: string,
  fullName: string,
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const nome = fullName.trim();
  if (nome.length < 2 || nome.length > 120) {
    return { ok: false, mensagem: "Informe um nome de 2 a 120 caracteres." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ full_name: nome })
    .eq("id", clientId)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, mensagem: "Não foi possível salvar o nome. Tente novamente." };
  }
  await supabase.from("admin_audit_log").insert({
    action: "client_updated",
    client_id: clientId,
    client_username: username,
    client_full_name: nome,
    detail: { campo: "full_name" },
  });
  return { ok: true };
}
