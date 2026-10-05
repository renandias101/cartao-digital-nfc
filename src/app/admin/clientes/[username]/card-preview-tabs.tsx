"use client";

import { useId, useState } from "react";

import { DigitalCard } from "@/components/digital-card";
import cardStyles from "@/components/digital-card.module.css";
import type { CardContent } from "@/lib/card/types";
import type { CardFooter } from "@/lib/system/card-footer";

type Aba = "publicado" | "rascunho";

/**
 * Publicado × Rascunho com o MESMO `DigitalCard` da página pública e da
 * prévia do editor — o admin vê exatamente o que o visitante vê (aba
 * Publicado) e o que está salvo como rascunho.
 */
export function CardPreviewTabs({
  publicado,
  rascunho,
  footer,
}: {
  publicado: CardContent | null;
  rascunho: CardContent | null;
  footer: CardFooter | null;
}) {
  const [aba, setAba] = useState<Aba>(publicado ? "publicado" : "rascunho");
  const base = useId();
  const conteudo = aba === "publicado" ? publicado : rascunho;

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Versão do cartão" className="inline-flex w-fit gap-1 rounded-xl border border-border bg-muted/50 p-1">
        {(["publicado", "rascunho"] as const).map((valor) => (
          <button
            key={valor}
            type="button"
            role="tab"
            id={`${base}-${valor}`}
            aria-selected={aba === valor}
            aria-controls={`${base}-painel`}
            onClick={() => setAba(valor)}
            className={`min-h-9 rounded-lg px-4 text-sm font-medium transition-colors ${
              aba === valor ? "bg-card text-foreground shadow-sm" : "text-zinc-600 hover:text-foreground"
            }`}
          >
            {valor === "publicado" ? "Publicado" : "Rascunho"}
          </button>
        ))}
      </div>

      <div id={`${base}-painel`} role="tabpanel" aria-labelledby={`${base}-${aba}`}>
        {conteudo ? (
          <div
            className="mx-auto max-h-[640px] w-full max-w-[420px] overflow-y-auto overscroll-contain rounded-2xl border border-border"
            // A prévia é só visual: nada nela leva o admin para fora da ficha.
            inert
          >
            <div className={cardStyles.page} style={{ backgroundColor: conteudo.backgroundColor ?? "#ffffff" }}>
              <DigitalCard content={conteudo} preview footer={footer} />
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground">
            {aba === "publicado" ? "Este cartão nunca foi publicado." : "Rascunho não encontrado."}
          </p>
        )}
      </div>
    </div>
  );
}
