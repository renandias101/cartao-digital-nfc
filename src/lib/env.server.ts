import "server-only";

/**
 * Variáveis de ambiente restritas ao servidor.
 *
 * O import de `server-only` faz o build falhar se este módulo for alcançado
 * por código de cliente — barreira contra vazamento acidental da chave
 * secreta (Seguranca 1-5, PRD §42).
 */

function ausente(nome: string): never {
  throw new Error(
    `Variável de ambiente ausente: ${nome}. ` +
      "Copie .env.example para .env.local e preencha os valores.",
  );
}

export const serverEnv = {
  /**
   * Chave secreta do Supabase (`sb_secret_...`). IGNORA RLS.
   *
   * Uso restrito a operações administrativas que precisam atravessar o
   * isolamento — por exemplo criar um cliente. Toda chamada com esta chave
   * precisa validar a permissão do administrador antes, porque o banco não
   * vai fazer isso.
   */
  get supabaseSecretKey(): string {
    return process.env.SUPABASE_SECRET_KEY || ausente("SUPABASE_SECRET_KEY");
  },
};
