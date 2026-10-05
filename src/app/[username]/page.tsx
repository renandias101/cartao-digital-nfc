import type { Metadata } from "next";
import { DigitalCard } from "@/components/digital-card";
import styles from "@/components/digital-card.module.css";
import { notFound } from "next/navigation";

import { getPublicCard, usernameExists } from "@/lib/card/public";
import { getCardFooter } from "@/lib/system/card-footer-server";

/**
 * Página pública do cartão (PRD §62 — o que o NFC abre).
 *
 * Sem cache entre requisições (D43): o mecanismo recomendado do Next 16 para
 * isso serve conteúdo desatualizado de propósito, o que violaria a exigência
 * de efeito imediato do §23/§64. `getPublicCard`/`usernameExists` usam
 * `cache()` do React só para não repetir a consulta entre esta função e
 * `generateMetadata` na MESMA requisição — reinicia a cada visita.
 */
export async function generateMetadata(
  props: PageProps<"/[username]">,
): Promise<Metadata> {
  const { username } = await props.params;
  const card = await getPublicCard(username);

  // Fora do ar (ou nunca existiu): metadados genéricos, sem nome, sem foto,
  // sem descrição — nem para quem só vê o preview de link no WhatsApp
  // (regra invariável do projeto: nenhum metadado de compartilhamento fora
  // do status ATIVO).
  if (!card) {
    return {
      title: "Cartão Digital",
      description: "Cartão de visita digital.",
      robots: { index: false, follow: false },
      openGraph: { title: "Cartão Digital", description: "Cartão de visita digital." },
    };
  }

  return {
    title: card.displayName ?? "Cartão Digital",
    description: card.description,
    openGraph: {
      title: card.displayName,
      description: card.description,
      images: card.profilePhoto ? [card.profilePhoto] : undefined,
    },
  };
}

export default async function CartaoPublicoPage(props: PageProps<"/[username]">) {
  const { username } = await props.params;
  const card = await getPublicCard(username);

  if (!card) {
    // Existe mas está vencido/cancelado (PRD §24, §27): página neutra, 200,
    // nunca a palavra do status. Não existe de jeito nenhum (PRD §49) ou foi
    // excluído (PRD §50): 404 de verdade, via not-found.tsx deste segmento.
    // A distinção usa só existência (`username_exists`), nunca o status.
    if (await usernameExists(username)) {
      return (
        <main className="flex min-h-dvh items-center justify-center p-6">
          <div className="w-full max-w-sm text-center">
            <h1 className="text-lg font-semibold">Cartão indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este cartão digital não está disponível.
            </p>
          </div>
        </main>
      );
    }
    notFound();
  }

  // Rodapé do sistema só no cartão ativo: a página neutra acima não mostra nada.
  const footer = await getCardFooter();
  return (
    <main className={styles.page} style={{ backgroundColor: card.backgroundColor ?? "#ffffff" }}>
      <DigitalCard content={card} footer={footer} />
    </main>
  );
}
