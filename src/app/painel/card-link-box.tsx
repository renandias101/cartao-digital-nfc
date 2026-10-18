"use client";

import { useEffect, useState } from "react";

import { IconCheck, IconCopy, IconLink } from "@/components/icons";
import styles from "@/app/painel/editor/editor.module.css";
import { copyText } from "@/lib/browser/copy-text";

const MENSAGEM_MS = 3000;

/**
 * Copia pela API moderna e, se ela não existir ou for recusada (página em
 * HTTP fora do localhost, permissão negada), por um campo temporário.
 */
/** Link público do cartão com botão de copiar e mensagem que some em 3 segundos. */
export function CardLinkBox({ url }: { url: string }) {
  const [resultado, setResultado] = useState<"ok" | "erro" | null>(null);
  const exibido = url.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (!resultado) return;
    const timer = window.setTimeout(() => setResultado(null), MENSAGEM_MS);
    return () => window.clearTimeout(timer);
  }, [resultado]);

  const copiado = resultado === "ok";

  return (
    <div className={styles.linkBox}>
      <IconLink className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Link do cartão</p>
        <p className="truncate text-sm font-medium" title={url}>
          {exibido}
        </p>
      </div>
      {resultado ? (
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            copiado ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {copiado ? "Link copiado!" : "Não foi possível copiar"}
        </span>
      ) : null}
      <button
        type="button"
        onClick={async () => setResultado((await copyText(url)) ? "ok" : "erro")}
        aria-label="Copiar link do cartão"
        title="Copiar link"
        className={`ui-btn ui-btn-ghost ui-btn-icon shrink-0 ${copiado ? "text-success" : ""}`}
      >
        {copiado ? <IconCheck /> : <IconCopy />}
      </button>
      <span role="status" className="sr-only">
        {copiado ? "Link copiado." : resultado === "erro" ? "Não foi possível copiar o link." : ""}
      </span>
    </div>
  );
}
