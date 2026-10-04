"use client";

import { useState } from "react";

import type { EstadoAcao } from "@/app/painel/editor/actions";
import { AnchoredPopover } from "@/app/painel/editor/anchored-popover";
import { ConfirmDialog } from "@/app/painel/editor/confirm-dialog";
import type { DraftSaveState } from "@/app/painel/editor/use-draft-autosave";
import { IconCheck, IconTrash, IconUndo } from "@/components/icons";
import styles from "./editor.module.css";

function horario(data: Date): string {
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Indicador discreto do salvamento automático. */
function SaveIndicator({ state }: { state: DraftSaveState }) {
  if (state.error) {
    return (
      <p className={`${styles.saveStatus} text-destructive`}>
        <span aria-hidden="true" className={`${styles.saveDot} bg-destructive`} />
        <span role="alert">Não foi possível salvar: {state.error}</span>
      </p>
    );
  }
  const salvando = state.saving || state.dirty;
  return (
    <p className={styles.saveStatus}>
      <span
        aria-hidden="true"
        className={`${styles.saveDot} ${salvando ? `bg-gold ${styles.saveDotPulse}` : "bg-success"}`}
      />
      {salvando
        ? "Salvando…"
        : state.savedAt
          ? "Alterações salvas automaticamente"
          : "Salvamento automático ativado"}
    </p>
  );
}

/**
 * Rodapé do editor: descartar (volta à versão publicada, com confirmação),
 * rascunhos (estado do salvamento e "salvar agora") e publicar.
 */
export function DraftActions({
  saveState,
  hasUnpublishedChanges,
  pending,
  message,
  onSaveNow,
  onPublish,
  onDiscard,
}: {
  saveState: DraftSaveState;
  hasUnpublishedChanges: boolean;
  pending: boolean;
  message: EstadoAcao;
  onSaveNow: () => void;
  onPublish: () => void;
  onDiscard: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const naoPublicado = hasUnpublishedChanges || saveState.dirty;

  return (
    <section className={styles.actionBar} aria-label="Ações do cartão">
      <div className={styles.actionStatus}>
        <SaveIndicator state={saveState} />
        {message.mensagem ? (
          <p
            role={message.ok ? "status" : "alert"}
            className={`text-sm ${message.ok ? "text-success" : "text-destructive"}`}
          >
            {message.mensagem}
          </p>
        ) : null}
      </div>
      <div className={styles.actionButtons}>
        <button
          type="button"
          disabled={pending || !naoPublicado}
          onClick={() => setConfirmando(true)}
          className={`ui-btn ui-btn-outline relative ${styles.discardButton}`}
        >
          <IconTrash />
          <span>
            Descartar<span className={styles.discardMore}> alterações</span>
          </span>
        </button>
        <AnchoredPopover
          role="dialog"
          label="Rascunhos"
          align="start"
          triggerClassName="ui-btn ui-btn-outline"
          triggerContent={
            <>
              <IconUndo />
              Rascunhos
            </>
          }
          className="w-[min(20rem,calc(100vw-1rem))]"
        >
          <div className="flex flex-col gap-3 p-2.5 text-sm">
            <div>
              <p className="font-semibold">Rascunho</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                O que você edita fica salvo automaticamente como rascunho. Quem visita o cartão só vê as mudanças
                depois que você publicar.
              </p>
            </div>
            <dl className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Rascunho</dt>
                <dd className="text-right font-medium">
                  {saveState.error
                    ? "Não salvo"
                    : saveState.saving || saveState.dirty
                      ? "Salvando…"
                      : saveState.savedAt
                        ? `Salvo às ${horario(saveState.savedAt)}`
                        : "Salvo"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Cartão publicado</dt>
                <dd className="text-right font-medium">
                  {naoPublicado ? "Há alterações não publicadas" : "Igual ao rascunho"}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={pending || saveState.saving || (!saveState.dirty && !saveState.error)}
              onClick={onSaveNow}
              className="ui-btn ui-btn-outline ui-btn-sm"
            >
              Salvar rascunho
            </button>
          </div>
        </AnchoredPopover>
        <button
          type="button"
          disabled={pending}
          onClick={onPublish}
          className={`ui-btn ui-btn-primary ${styles.publishButton}`}
        >
          <IconCheck />
          Publicar alterações
        </button>
      </div>

      <ConfirmDialog
        open={confirmando}
        title="Descartar alterações não publicadas?"
        description="Seu cartão voltará para a última versão publicada."
        confirmLabel="Descartar"
        onCancel={() => setConfirmando(false)}
        onConfirm={() => {
          setConfirmando(false);
          onDiscard();
        }}
      />
    </section>
  );
}
