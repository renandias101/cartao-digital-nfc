"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { salvarRascunhoAction, type EstadoAcao } from "@/app/painel/editor/actions";
import { validarBotoes } from "@/lib/card/buttons";
import type { CardContent } from "@/lib/card/types";
import { validarConteudoCartao } from "@/lib/card/validation";

/** Pausa depois da última alteração antes de gravar o rascunho. */
const AUTOSAVE_DELAY_MS = 1200;

export type DraftSaveState = {
  /** Há algo na tela que ainda não está gravado em `card_drafts`. */
  dirty: boolean;
  saving: boolean;
  /** Última falha (validação ou rede); some no próximo salvamento bem-sucedido. */
  error: string | null;
  savedAt: Date | null;
};

/**
 * Salvamento automático do rascunho (PRD §16). Usa a MESMA Server Action do
 * salvamento manual — só decide quando chamá-la. As gravações saem em fila,
 * na ordem das edições, para uma resposta antiga nunca sobrescrever uma nova.
 * A validação local é só para não fazer viagem inútil: o servidor e a CHECK
 * do banco continuam sendo a autoridade.
 */
export function useDraftAutosave(content: CardContent, initialContent: CardContent, enabled: boolean) {
  const [savedContent, setSavedContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const paused = useRef(false);

  const dirty = JSON.stringify(content) !== JSON.stringify(savedContent);

  const persist = useCallback(async (snapshot: CardContent): Promise<EstadoAcao> => {
    const cartao = validarConteudoCartao(snapshot, false);
    const botoes = validarBotoes(snapshot.buttons);
    const invalido = !cartao.valido ? cartao.mensagem : !botoes.valido ? botoes.mensagem : null;
    if (invalido) {
      setError(invalido);
      return { ok: false, mensagem: invalido };
    }
    setSaving(true);
    try {
      const resultado = await salvarRascunhoAction(snapshot);
      if (resultado.ok) {
        setSavedContent(snapshot);
        setSavedAt(new Date());
        setError(null);
      } else {
        setError(resultado.mensagem);
      }
      return resultado;
    } catch {
      const mensagem = "Não foi possível salvar. Seus dados continuam nesta tela. Tente novamente.";
      setError(mensagem);
      return { ok: false, mensagem };
    } finally {
      setSaving(false);
    }
  }, []);

  /** Grava agora (depois das gravações já na fila). */
  const saveNow = useCallback(
    (snapshot: CardContent): Promise<EstadoAcao> => {
      const run = queue.current.then(() => persist(snapshot));
      queue.current = run.catch(() => undefined);
      return run;
    },
    [persist],
  );

  /** Para o salvamento automático e espera o que já saiu (antes de descartar). */
  const pause = useCallback(async () => {
    paused.current = true;
    await queue.current;
  }, []);

  const resume = useCallback(() => {
    paused.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || !dirty) return;
    const timer = window.setTimeout(() => {
      if (!paused.current) void saveNow(content);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, dirty, content, saveNow]);

  const state: DraftSaveState = { dirty, saving, error, savedAt };
  return { state, saveNow, pause, resume };
}
