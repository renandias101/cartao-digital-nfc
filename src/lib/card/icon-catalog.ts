/**
 * Catálogo ÚNICO dos ícones do sistema que o cliente pode escolher para um
 * botão. A chave é o que fica salvo em `button.icon` — por isso as chaves
 * antigas nunca mudam de nome, mesmo quando o rótulo é melhorado.
 *
 * Cada ícone aparece uma vez. Palavras alternativas ("website", "internet"…)
 * entram em `keywords` e só servem à busca: levam à MESMA opção, sem criar
 * outra. O desenho de cada chave mora em `components/system-icons.tsx`
 * (o tipo `Record<SystemIconKey, …>` de lá obriga a manter os dois em dia).
 */

export const ICON_CATEGORIES = [
  { id: "contact", label: "Contato" },
  { id: "social", label: "Redes sociais" },
  { id: "digital", label: "Presença digital" },
  { id: "business", label: "Negócios" },
  { id: "utility", label: "Utilidades" },
] as const;

export type IconCategoryId = (typeof ICON_CATEGORIES)[number]["id"];

type IconEntry = {
  key: string;
  label: string;
  category: IconCategoryId;
  keywords: readonly string[];
};

export const ICON_CATALOG = [
  // Contato
  { key: "whatsapp", label: "WhatsApp", category: "contact", keywords: ["zap", "whats", "mensagem", "conversa", "chat"] },
  { key: "phone", label: "Telefone", category: "contact", keywords: ["ligar", "celular", "ligacao", "fone", "tel"] },
  { key: "email", label: "E-mail", category: "contact", keywords: ["email", "correio", "carta", "mail", "gmail", "outlook"] },
  { key: "telegram", label: "Telegram", category: "contact", keywords: ["telegran", "mensagem", "chat"] },
  { key: "contact", label: "Contato / pessoa", category: "contact", keywords: ["salvar contato", "agenda", "perfil", "usuario", "pessoa", "vcard"] },
  // Redes sociais
  { key: "instagram", label: "Instagram", category: "social", keywords: ["insta", "ig", "fotos"] },
  { key: "facebook", label: "Facebook", category: "social", keywords: ["face", "fb", "meta"] },
  { key: "linkedin", label: "LinkedIn", category: "social", keywords: ["linkedin", "profissional", "carreira", "curriculo"] },
  { key: "tiktok", label: "TikTok", category: "social", keywords: ["tik tok", "video curto", "reels"] },
  { key: "youtube", label: "YouTube", category: "social", keywords: ["you tube", "video", "canal", "yt"] },
  { key: "x", label: "X (Twitter)", category: "social", keywords: ["twitter", "tweet"] },
  { key: "pinterest", label: "Pinterest", category: "social", keywords: ["pin", "inspiracao", "imagens"] },
  // Presença digital
  { key: "globe", label: "Site", category: "digital", keywords: ["website", "web", "internet", "globo", "pagina", "www", "dominio", "blog"] },
  { key: "link", label: "Link", category: "digital", keywords: ["url", "atalho", "endereco web", "corrente"] },
  { key: "briefcase", label: "Portfólio", category: "digital", keywords: ["portfolio", "trabalhos", "projetos", "maleta", "case"] },
  { key: "monitor", label: "Computador / serviços", category: "digital", keywords: ["servicos", "tela", "desktop", "sistema", "tecnologia"] },
  // Negócios
  { key: "catalog", label: "Catálogo", category: "business", keywords: ["catalogo", "produtos", "livro", "revista", "lista de produtos"] },
  { key: "menu", label: "Cardápio", category: "business", keywords: ["cardapio", "restaurante", "comida", "garfo", "faca", "delivery"] },
  { key: "store", label: "Loja", category: "business", keywords: ["comprar", "vendas", "ecommerce", "e-commerce", "mercado", "shop"] },
  { key: "calendar", label: "Agendamento", category: "business", keywords: ["agendar", "agenda", "calendario", "reservar", "reserva", "horario", "data"] },
  { key: "star", label: "Avaliações", category: "business", keywords: ["avaliacoes", "avaliacao", "estrela", "reviews", "opiniao", "depoimentos", "nota"] },
  // Utilidades
  { key: "card", label: "Pix / pagamento", category: "utility", keywords: ["pix", "cartao", "pagar", "pagamento", "cobranca", "banco"] },
  { key: "lock", label: "Wi-Fi / cadeado", category: "utility", keywords: ["wifi", "wi-fi", "senha", "rede", "internet sem fio", "seguranca"] },
  { key: "map-pin", label: "Endereço / localização", category: "utility", keywords: ["endereco", "localizacao", "mapa", "onde", "como chegar", "local"] },
  { key: "note", label: "Documento / texto", category: "utility", keywords: ["documento", "texto", "informacao", "informacoes", "nota", "anotacao", "pdf", "arquivo"] },
] as const satisfies readonly IconEntry[];

export type SystemIconKey = (typeof ICON_CATALOG)[number]["key"];

export function isSystemIconKey(icon: string | undefined): icon is SystemIconKey {
  return icon !== undefined && ICON_CATALOG.some((entry) => entry.key === icon);
}

/** Minúsculas e sem acento: "Cardápio" e "cardapio" são a mesma busca. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
}

/**
 * Ícones que combinam com a busca (todas as palavras digitadas precisam
 * aparecer no nome, na categoria ou nos sinônimos). Cada ícone sai no máximo
 * uma vez, na ordem do catálogo. Busca vazia devolve todos.
 */
export function searchIcons(query: string): ReadonlyArray<(typeof ICON_CATALOG)[number]> {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return ICON_CATALOG;
  return ICON_CATALOG.filter((entry) => {
    const category = ICON_CATEGORIES.find((c) => c.id === entry.category)?.label ?? "";
    const haystack = normalize([entry.label, category, ...entry.keywords].join(" "));
    return words.every((word) => haystack.includes(word));
  });
}
