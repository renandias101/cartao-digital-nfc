"use client";

import { useState } from "react";

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
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // `navigator.clipboard` pode falhar (contexto não seguro,
          // permissão negada) — a página não deve quebrar por isso, só o
          // feedback de sucesso não aparece.
        }
      }}
      className={className}
    >
      {copiado ? "Copiado com sucesso." : label}
    </button>
  );
}
