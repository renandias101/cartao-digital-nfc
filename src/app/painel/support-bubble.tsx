"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { ContadorCaracteres } from "@/app/painel/editor/character-counter";
import { enviarSuporteAction, type SuporteState } from "@/app/painel/support-actions";
import { IconAlert, IconClose, IconHelp } from "@/components/icons";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";
import { LIMITE_SUPORTE, type SupportKind } from "@/lib/support/support";

const ESTADO_INICIAL: SuporteState = { ok: null, mensagem: null };

/**
 * Distância do balão até a borda de baixo. No celular a barra "Publicar
 * alterações" fica presa embaixo, na largura toda: o balão sobe para ficar
 * logo acima dela. No computador a barra fica na coluna da esquerda e o
 * canto direito está livre.
 */
function useDistanciaDaBarra(): number {
  const [distancia, setDistancia] = useState(0);
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const barra = document.querySelector<HTMLElement>("[data-editor-action-bar]");
        const rect = barra?.getBoundingClientRect();
        const cobreOCanto = rect && rect.right > window.innerWidth - 96 && rect.top < window.innerHeight;
        setDistancia(cobreOCanto ? Math.max(0, window.innerHeight - rect.top) : 0);
      });
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    const observador = new ResizeObserver(medir);
    observador.observe(document.body);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      observador.disconnect();
    };
  }, []);
  return distancia;
}

/** Balão de suporte do editor: reportar um erro ou pedir ajuda. */
export function SupportBubble() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const [tipo, setTipo] = useState<SupportKind | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [state, formAction, pending] = useActionState(enviarSuporteAction, ESTADO_INICIAL);
  const falha = useTransientMessage(state.ok === false ? state : null, DURACAO_LEGENDA.erro);
  const distancia = useDistanciaDaBarra();

  // Envio aceito: limpa o formulário e mostra a confirmação no lugar dele.
  const [enviado, setEnviado] = useState<SuporteState | null>(null);
  if (state.ok && state !== enviado) {
    setEnviado(state);
    setTipo(null);
    setMensagem("");
    setErro("");
  }
  const confirmacao = useTransientMessage(enviado, 6000);

  function abrir() {
    dialogRef.current?.showModal();
  }
  function fechar() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-label="Ajuda e suporte: reportar um erro ou pedir ajuda"
        title="Ajuda e suporte"
        style={{ bottom: `calc(${distancia}px + 16px + env(safe-area-inset-bottom))` }}
        className="fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-sidebar text-sidebar-foreground shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none sm:right-6"
      >
        <IconHelp className="size-6" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={tituloId}
        onClick={(e) => {
          if (e.target === e.currentTarget) fechar();
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] max-h-[min(90dvh,44rem)] rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/40 sm:mr-6 sm:mb-6"
      >
        <div className="flex items-center gap-3 border-b border-border py-3 pr-3 pl-5">
          <h2 id={tituloId} className="flex-1 text-base font-semibold">
            Ajuda e suporte
          </h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="ui-btn ui-btn-ghost ui-btn-icon">
            <IconClose />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {confirmacao ? (
            <p role="status" className="rounded-xl bg-success-soft p-4 text-sm text-success">
              {confirmacao.mensagem}
            </p>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted-foreground">O que você precisa?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["error", "Reportar um erro", IconAlert],
                  ["help", "Pedir ajuda", IconHelp],
                ] as const
              ).map(([valor, rotulo, Icone]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={tipo === valor}
                  onClick={() => setTipo(valor)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    tipo === valor ? "border-gold bg-accent-soft text-foreground" : "border-input hover:bg-muted"
                  }`}
                >
                  <Icone className="size-5" />
                  {rotulo}
                </button>
              ))}
            </div>
          </fieldset>

          {tipo ? (
            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="kind" value={tipo} />
              <div className="space-y-1.5">
                <label htmlFor="suporte-mensagem" className="ui-label">
                  {tipo === "error" ? "O que você estava tentando fazer?" : "Com o que você precisa de ajuda?"}
                </label>
                <textarea
                  id="suporte-mensagem"
                  name="message"
                  required
                  rows={3}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder={
                    tipo === "error" ? "Ex.: trocar a foto de perfil" : "Ex.: quero colocar o link do meu cardápio"
                  }
                  aria-describedby="suporte-mensagem-contador"
                  className="ui-input"
                />
                <ContadorCaracteres id="suporte-mensagem-contador" texto={mensagem} limite={LIMITE_SUPORTE} />
              </div>

              {tipo === "error" ? (
                <div className="space-y-1.5">
                  <label htmlFor="suporte-erro" className="ui-label">
                    Qual erro apareceu?
                  </label>
                  <textarea
                    id="suporte-erro"
                    name="errorText"
                    required
                    rows={3}
                    value={erro}
                    onChange={(e) => setErro(e.target.value)}
                    placeholder="Copie a mensagem que apareceu ou descreva o que aconteceu"
                    aria-describedby="suporte-erro-contador"
                    className="ui-input"
                  />
                  <ContadorCaracteres id="suporte-erro-contador" texto={erro} limite={LIMITE_SUPORTE} />
                </div>
              ) : null}

              {falha ? (
                <p role="alert" className="text-sm text-destructive">
                  {falha.mensagem}
                </p>
              ) : null}

              <button type="submit" disabled={pending} className="ui-btn ui-btn-primary">
                {pending ? "Enviando…" : "Enviar"}
              </button>
            </form>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
