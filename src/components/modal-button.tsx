"use client";

import { useId, useRef, type ReactNode } from "react";

import { IconClose } from "@/components/icons";
import styles from "@/components/digital-card.module.css";

/**
 * Botão da página pública (texto, Wi-Fi) que abre o conteúdo num `<dialog>` nativo
 * (o navegador prende o foco, fecha no Esc e devolve o foco ao botão).
 * O conteúdo continua sendo texto puro, renderizado como os demais detalhes.
 */
export function ModalButton({
  buttonId,
  title,
  heading,
  children,
}: {
  buttonId: string;
  title: string;
  heading: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className={styles.action}
        data-button-id={buttonId}
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
      >
        {heading}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className={styles.modal}
        onClick={(e) => {
          // Clique no fundo escurecido (fora da caixa) fecha.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className={styles.modalHeader}>
          <h2 id={titleId} className={styles.modalTitle}>{title}</h2>
          <button type="button" className={styles.modalClose} aria-label="Fechar" onClick={() => ref.current?.close()}>
            <IconClose />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </dialog>
    </>
  );
}
