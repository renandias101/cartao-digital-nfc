import "server-only";

import { cache } from "react";

import { getActor } from "@/lib/auth/session";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  RODAPE_PADRAO,
  validarRodape,
  type CardFooter,
  type CardFooterSettings,
} from "@/lib/system/card-footer";

function isCardFooter(value: unknown): value is CardFooter {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return ["title", "subtitle", "buttonLabel", "url"].every((k) => typeof v[k] === "string");
}

/**
 * Rodapé exibido nos cartões, ou `null` quando o administrador desativou.
 * Mesmo modelo do cartão público: sem cache entre requisições (D43), e
 * `cache()` do React só deduplica dentro da mesma requisição. Se a leitura
 * falhar, mantém o texto padrão em vez de sumir com o rodapé.
 */
export const getCardFooter = cache(async (): Promise<CardFooter | null> => {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc("get_card_footer");
  if (error) {
    console.error(`Rodapé dos cartões: leitura falhou, usando o padrão. ${error.message}`);
    return RODAPE_PADRAO;
  }
  return isCardFooter(data) ? data : null;
});

/** Configuração completa para o painel do administrador (RLS: só admin lê). */
export async function getCardFooterSettings(): Promise<CardFooterSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("card_footer_settings")
    .select("enabled, title, subtitle, button_label, url")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return null;
  return {
    enabled: data.enabled,
    title: data.title,
    subtitle: data.subtitle,
    buttonLabel: data.button_label,
    url: data.url,
  };
}

/**
 * Grava o rodapé. Confere o administrador aqui e o banco confere de novo
 * (política com `private.is_admin()` e `check` da tabela).
 */
export async function saveCardFooterSettings(
  input: CardFooterSettings,
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const actor = await getActor();
  if (!actor.logado || !actor.isAdmin) {
    return { ok: false, mensagem: "Apenas o administrador pode alterar o rodapé." };
  }
  const validacao = validarRodape(input);
  if (!validacao.valido) return { ok: false, mensagem: validacao.mensagem };
  const { rodape } = validacao;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("card_footer_settings")
    .update({
      enabled: rodape.enabled,
      title: rodape.title,
      subtitle: rodape.subtitle,
      button_label: rodape.buttonLabel,
      url: rodape.url,
      updated_by: actor.userId,
    })
    .eq("id", true)
    .select("id");
  // Sem linha atualizada = política recusou ou a tabela ainda não existe.
  if (error || !data?.length) {
    return { ok: false, mensagem: "Não foi possível salvar o rodapé. Tente novamente." };
  }
  return { ok: true };
}
