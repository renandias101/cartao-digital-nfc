/**
 * Constantes de negócio já fechadas pelo PRD.
 *
 * Fonte única para evitar a mesma regra repetida em validação de formulário,
 * Server Action e banco (Arquitetura-e-Codigo 19).
 *
 * A lista de nomes de usuário reservados NÃO fica aqui: ela vive na tabela
 * `public.reserved_usernames`, semeada pela migration. O banco é a autoridade,
 * porque também precisa registrar os slugs liberados por exclusão de cliente.
 * Manter uma segunda cópia em código só criaria divergência.
 */

/** Regras de formato do nome de usuário, base da URL pública (PRD §5, §6). */
export const USERNAME = {
  minimo: 3,
  maximo: 32,
  /**
   * Minúsculas, números e hífen. Precisa começar e terminar com letra ou
   * número, e não aceita hífen duplicado — evita URL ambígua e confusão
   * visual entre nomes parecidos.
   */
  padrao: /^[a-z0-9](?:[a-z0-9]|-(?!-)){1,30}[a-z0-9]$/,
} as const;

/** Limites de texto para preservar o layout (PRD §56). */
export const LIMITES_TEXTO = {
  profession: 60,
  nomeExibido: 60,
  descricaoPrincipal: 250,
  tituloBotao: 40,
  descricaoBotao: 100,
  textoInformativo: 1000,
  telefoneContato: 30,
} as const;

/** Telefone do "Salvar Contato": dígitos, espaço e + ( ) - . (vazio = sem número). Igual ao banco. */
export const REGEX_TELEFONE_CONTATO = /^[0-9+() .-]{0,30}$/;

/**
 * Tamanho de um texto do jeito que o banco conta (`length()` do Postgres):
 * um emoji é UM caractere. `string.length` e o `maxLength` do navegador
 * contam unidades UTF-16 — emoji vale 2 — e travavam a digitação antes do
 * limite real.
 */
export function contarCaracteres(texto: string): number {
  return Array.from(texto).length;
}

/** Máximo de botões por cartão, ativos ou não (PRD §11). */
export const MAX_BOTOES = 10;

/** Regras de upload de imagem (PRD §10). */
export const UPLOAD_IMAGEM = {
  tamanhoMaximoBytes: 5 * 1024 * 1024,
  /**
   * Tipos aceitos. SVG está fora de propósito: é executável no navegador e
   * abriria caminho para XSS via arquivo enviado pelo cliente.
   */
  tiposAceitos: ["image/jpeg", "image/png", "image/webp"] as const,
  extensoesAceitas: [".jpg", ".jpeg", ".png", ".webp"] as const,
} as const;

/** Esquemas aceitos em botões de link (PRD §46). Bloqueia `javascript:` e `data:`. */
export const ESQUEMAS_URL_ACEITOS = ["http:", "https:"] as const;
