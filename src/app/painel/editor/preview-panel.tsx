"use client";

import { useButtonDrag, type DropTarget } from "@/app/painel/editor/use-button-drag";
import { DigitalCard } from "@/components/digital-card";
import type { CardContent } from "@/lib/card/types";
import styles from "./editor.module.css";

/** Prévia fiel do cartão; segurar um botão nela permite arrastá-lo. */
export function PreviewPanel({
  content,
  onMoveButton,
}: {
  content: CardContent;
  onMoveButton: (id: string, target: DropTarget) => void;
}) {
  const ref = useButtonDrag(onMoveButton);
  return (
    <div ref={ref} className={`${styles.previewViewport} ${styles.arrangeable}`}>
      <DigitalCard content={content} preview />
    </div>
  );
}
