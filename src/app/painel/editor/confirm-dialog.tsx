"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Confirmação de ação destrutiva com `<dialog>` nativo: o navegador já cuida
 * de prender o foco, fechar no Esc e devolver o foco a quem abriu.
 * O foco começa em "Cancelar" — a opção segura.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // Clique no fundo escurecido (fora da caixa) cancela.
        if (e.target === e.currentTarget) onCancel();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-2 p-5">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="ui-btn ui-btn-outline">
            Cancelar
          </button>
          <button type="button" data-confirm onClick={onConfirm} className="ui-btn ui-btn-danger">
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
