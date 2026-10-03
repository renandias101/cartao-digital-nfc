import "server-only";

import { cache } from "react";

import type { CardContent } from "@/lib/card/types";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";

/**
 * Dados públicos do cartão (PRD §62). Sem cache entre requisições — decisão
 * registrada em D43 (docs/DECISOES-TECNICAS.md): o mecanismo "recomendado"
 * do Next 16 para isto (`revalidateTag` com perfil `max`) serve conteúdo
 * desatualizado de propósito, o que violaria o §23/§64 ("imediatamente").
 *
 * `cache()` do React (não do Next) é só deduplicação DENTRO de uma mesma
 * requisição — `generateMetadata` e a página chamam a mesma função sem
 * consultar o banco duas vezes. Reinicia a cada requisição nova, sem risco
 * de servir dado velho para o próximo visitante.
 */
export const getPublicCard = cache(async (username: string): Promise<CardContent | null> => {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc("get_public_card", { p_username: username });
  if (error) {
    throw new Error(`Não foi possível carregar o cartão: ${error.message}`);
  }
  return (data as CardContent | null) ?? null;
});

/** Só para decidir "não encontrado" vs. "não disponível" — nunca revela o status (PRD §21). */
export const usernameExists = cache(async (username: string): Promise<boolean> => {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc("username_exists", { p_username: username });
  if (error) return false;
  return Boolean(data);
});
