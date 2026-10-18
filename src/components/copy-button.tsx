"use client";

import { useState } from "react";

import { copyText } from "@/lib/browser/copy-text";

/**
 * Botão de copiar com feedback visual (PRD §47: "Copiado com sucesso.").
 * `className` só troca a aparência (o painel usa o estilo dele); sem ela, o
 * visual é o da página pública.
 */
export function CopyButton({
  value,
  label,
  className = "mt-2 rounded-md border border-current/20 px-3 py-1.5 text-sm",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [result, setResult] = useState<"ok" | "error" | null>(null);

  return (
    <button
      type="button"
      onClick={async () => {
        setResult((await copyText(value)) ? "ok" : "error");
        setTimeout(() => setResult(null), 2000);
      }}
      className={className}
    >
      {result === "ok" ? "Copiado com sucesso." : result === "error" ? "Não foi possível copiar." : label}
    </button>
  );
}
