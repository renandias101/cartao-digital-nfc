import { getContactCardData } from "@/lib/card/vcard";
import type { CardContent } from "@/lib/card/types";

/**
 * "Saúde do cartão" — regras num lugar só (a tela só desenha o resultado).
 *
 * Os itens olham a versão PUBLICADA, que é o que o visitante vê. Sem
 * publicação, olham o rascunho, para mostrar o que falta antes de publicar.
 *
 * Classificação:
 *   Incompleto      — nunca publicado, ou sem nome no cartão (o essencial falta).
 *   Requer atenção  — qualquer aviso: assinatura vencendo/vencida/cancelada,
 *                     alterações não publicadas, nenhum botão ativo, sem
 *                     telefone para o "Salvar Contato", sem foto.
 *   Saudável        — nenhum aviso.
 */
export type NivelSaude = "saudavel" | "atencao" | "incompleto";
export type SituacaoItem = "ok" | "aviso" | "falta";

export type ItemSaude = { chave: string; situacao: SituacaoItem; texto: string };

export type EntradaSaude = {
  status: "active" | "expired" | "cancelled";
  diasParaVencer: number;
  estadoCartao: "never_published" | "pending_changes" | "up_to_date";
  publicado: CardContent | null;
  rascunho: CardContent | null;
};

export const ROTULO_NIVEL: Record<NivelSaude, string> = {
  saudavel: "Saudável",
  atencao: "Requer atenção",
  incompleto: "Incompleto",
};

/** Dias antes do vencimento em que a assinatura passa a pedir atenção (mesmo do filtro). */
export const DIAS_ALERTA_VENCIMENTO = 15;

export function avaliarSaudeDoCartao(e: EntradaSaude): { nivel: NivelSaude; itens: ItemSaude[] } {
  const itens: ItemSaude[] = [];
  const cartao = e.publicado ?? e.rascunho;

  if (e.status === "active") {
    itens.push(
      e.diasParaVencer <= DIAS_ALERTA_VENCIMENTO
        ? { chave: "assinatura", situacao: "aviso", texto: `Assinatura vence em ${Math.max(0, e.diasParaVencer)} dia(s)` }
        : { chave: "assinatura", situacao: "ok", texto: "Assinatura ativa" },
    );
  } else {
    itens.push({
      chave: "assinatura",
      situacao: "aviso",
      texto: e.status === "expired" ? "Assinatura vencida — cartão fora do ar" : "Cliente cancelado — cartão fora do ar",
    });
  }

  if (e.estadoCartao === "never_published") {
    itens.push({ chave: "publicacao", situacao: "falta", texto: "Cartão nunca publicado" });
  } else if (e.estadoCartao === "pending_changes") {
    itens.push({ chave: "publicacao", situacao: "aviso", texto: "Existem alterações não publicadas" });
  } else {
    itens.push({ chave: "publicacao", situacao: "ok", texto: "Cartão publicado e atualizado" });
  }

  const nome = cartao?.displayName?.trim();
  itens.push(nome
    ? { chave: "nome", situacao: "ok", texto: "Nome configurado" }
    : { chave: "nome", situacao: "falta", texto: "Nome do cartão ausente" });

  itens.push(cartao?.profilePhoto
    ? { chave: "foto", situacao: "ok", texto: "Foto configurada" }
    : { chave: "foto", situacao: "aviso", texto: "Sem foto de perfil" });

  // Mesma regra do botão: sem nome ou sem telefone, o "Salvar Contato" não aparece.
  itens.push(cartao && getContactCardData(cartao)
    ? { chave: "contato", situacao: "ok", texto: "Telefone do “Salvar Contato” configurado" }
    : { chave: "contato", situacao: "aviso", texto: "Sem telefone — o “Salvar Contato” não aparece" });

  const ativos = cartao?.buttons.filter((b) => b.enabled).length ?? 0;
  itens.push(ativos > 0
    ? { chave: "botoes", situacao: "ok", texto: `${ativos} ${ativos === 1 ? "botão ativo" : "botões ativos"}` }
    : { chave: "botoes", situacao: "aviso", texto: "Nenhum botão ativo" });

  const nivel: NivelSaude = itens.some((i) => i.situacao === "falta")
    ? "incompleto"
    : itens.some((i) => i.situacao === "aviso")
      ? "atencao"
      : "saudavel";
  return { nivel, itens };
}
