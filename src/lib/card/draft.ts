import "server-only";

import { validarBotoes } from "@/lib/card/buttons";
import type { CardContent } from "@/lib/card/types";
import { validarConteudoCartao } from "@/lib/card/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResultadoSalvar = { ok: true } | { ok: false; mensagem: string };

/**
 * Lê o rascunho do cliente logado (RLS: `card_drafts_select_own`).
 * Nota sobre tipos: ver D32 em docs/DECISOES-TECNICAS.md — sem `Database`
 * gerado, o retorno é `as`-castado, não inferido pela biblioteca.
 */
export async function getDraft(): Promise<CardContent | null> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("card_drafts")
    .select("content")
    .eq("client_id", userData.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o rascunho: ${error.message}`);
  }
  return (data?.content as CardContent) ?? null;
}

/**
 * Salva o rascunho do PRÓPRIO cliente (PRD §16). Valida no modo permissivo
 * (campo ausente é ok) — a validação completa só é exigida para publicar.
 *
 * A validação aqui é conveniência de UX (mensagem específica, sem round-trip
 * até o banco para descobrir o que está errado); o CHECK constraint
 * continua sendo quem de fato impede gravar algo inválido, path nenhum
 * escapa dele.
 */
export async function saveDraft(content: CardContent): Promise<ResultadoSalvar> {
  const validacaoCartao = validarConteudoCartao(content, false);
  if (!validacaoCartao.valido) {
    return { ok: false, mensagem: validacaoCartao.mensagem };
  }
  const validacaoBotoes = validarBotoes(content.buttons);
  if (!validacaoBotoes.valido) {
    return { ok: false, mensagem: validacaoBotoes.mensagem };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, mensagem: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .from("card_drafts")
    .update({ content })
    .eq("client_id", userData.user.id);

  if (error) {
    return { ok: false, mensagem: "Não foi possível salvar. Tente novamente." };
  }
  return { ok: true };
}

export type ResultadoPublicar = { ok: true } | { ok: false; mensagem: string };

/** Publica o rascunho atual (PRD §17). Só o banco decide se está completo. */
export async function publishCard(): Promise<ResultadoPublicar> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("publish_card");

  if (error) {
    // A mensagem da exceção do Postgres já é apresentável (ver a função
    // `publish_card` na migration) — não existe detalhe técnico a esconder.
    return { ok: false, mensagem: error.message };
  }
  return { ok: true };
}

/** Restaura o rascunho para a última versão publicada (PRD §18). */
export async function restoreDraft(): Promise<ResultadoPublicar> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("restore_draft");

  if (error) {
    return { ok: false, mensagem: error.message };
  }
  return { ok: true };
}
