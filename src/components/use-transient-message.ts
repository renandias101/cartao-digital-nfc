"use client";

import { useEffect, useState } from "react";

/** Quanto tempo cada legenda fica na tela. Erro fica mais, para dar tempo de ler. */
export const DURACAO_LEGENDA = { sucesso: 4000, erro: 8000 } as const;

/**
 * Mostra `value` por `ms` milissegundos e depois devolve `null`.
 *
 * Cada valor novo (outro objeto de `useActionState`, ou outra mensagem)
 * reinicia o tempo; voltar a `null` e repetir a mesma mensagem mostra de novo.
 * Ajuste de estado durante a renderização (padrão do React para "derivar do
 * valor anterior"), sem efeito extra só para copiar a prop.
 */
export function useTransientMessage<T>(value: T | null | undefined, ms: number): T | null {
  const [anterior, setAnterior] = useState(value);
  const [visivel, setVisivel] = useState<{ value: T } | null>(value == null ? null : { value });
  if (value !== anterior) {
    setAnterior(value);
    setVisivel(value == null ? null : { value });
  }

  useEffect(() => {
    if (!visivel) return;
    const timer = window.setTimeout(() => setVisivel(null), ms);
    return () => window.clearTimeout(timer);
  }, [visivel, ms]);

  return visivel?.value ?? null;
}
