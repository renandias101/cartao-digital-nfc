/**
 * Acesso tipado às variáveis de ambiente públicas.
 *
 * A leitura é preguiçosa de propósito: um getter só falha quando a variável é
 * realmente usada. Validar no carregamento do módulo derrubaria o build em
 * ambientes que ainda não têm as variáveis configuradas.
 *
 * Nada aqui é segredo — tudo é entregue ao navegador. O isolamento entre
 * clientes é responsabilidade do RLS, nunca de esconder estes valores.
 */

function ausente(nome: string): never {
  throw new Error(
    `Variável de ambiente ausente: ${nome}. ` +
      "Copie .env.example para .env.local e preencha os valores.",
  );
}

export const publicEnv = {
  /** URL do projeto Supabase. */
  get supabaseUrl(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || ausente("NEXT_PUBLIC_SUPABASE_URL");
  },

  /** Chave publicável (`sb_publishable_...`). Segura para expor. */
  get supabasePublishableKey(): string {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      ausente("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    );
  },

  /** Origem usada para montar a URL pública gravada no NFC (PRD §6). Sem barra final. */
  get siteUrl(): string {
    const valor = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return valor.replace(/\/+$/, "");
  },

  /** WhatsApp de contato para renovação, exibido no painel do cliente (PRD §25). */
  get whatsappRenovacao(): string {
    return process.env.NEXT_PUBLIC_WHATSAPP_RENOVACAO || "5596981233398";
  },
};

/** Monta a URL pública de um cartão a partir do nome de usuário (PRD §6). */
export function urlPublicaDoCartao(username: string): string {
  return `${publicEnv.siteUrl}/${username}`;
}
