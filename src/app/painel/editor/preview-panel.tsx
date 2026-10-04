"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useButtonDrag, type DropTarget } from "@/app/painel/editor/use-button-drag";
import { DigitalCard } from "@/components/digital-card";
import cardStyles from "@/components/digital-card.module.css";
import { IconMonitor, IconSmartphone } from "@/components/icons";
import type { CardContent } from "@/lib/card/types";
import styles from "./editor.module.css";

/** Largura simulada da tela no modo Desktop; a prévia é reduzida para caber. */
const DESKTOP_WIDTH = 1280;
/** Mesmo ponto em que o editor passa a ter duas colunas (editor.module.css). */
const WIDE_QUERY = "(min-width: 960px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Prévia fiel do cartão: o MESMO `DigitalCard` da página pública, com o
 * rascunho em edição. No celular a prévia já é do tamanho real — a escolha
 * Celular/Desktop só aparece com as duas colunas.
 */
export function PreviewPanel({
  content,
  onMoveButton,
}: {
  content: CardContent;
  onMoveButton: (id: string, target: DropTarget) => void;
}) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
  const showDesktop = wide && device === "desktop";

  return (
    <aside aria-labelledby="titulo-previa" className={styles.previewColumn}>
      <header className={styles.previewHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <IconSmartphone />
        </span>
        <div className={styles.sectionHeading}>
          <h2 id="titulo-previa">Pré-visualização</h2>
          <p>Veja como seu cartão ficará para outras pessoas.</p>
        </div>
        <div role="group" aria-label="Tamanho da tela da prévia" className={styles.deviceToggle}>
          <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
            <IconSmartphone />
            Celular
          </button>
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
            <IconMonitor />
            Desktop
          </button>
        </div>
      </header>

      {showDesktop ? <DesktopPreview content={content} /> : <PhonePreview content={content} onMoveButton={onMoveButton} />}

      {showDesktop ? null : (
        <p className={styles.previewTip}>
          Dica: segure um item na prévia e arraste para reorganizar. As alterações aparecem aqui na hora.
        </p>
      )}
    </aside>
  );
}

/** Segurar um botão na prévia permite arrastá-lo, como na lista do editor. */
function PhonePreview({
  content,
  onMoveButton,
}: {
  content: CardContent;
  onMoveButton: (id: string, target: DropTarget) => void;
}) {
  const ref = useButtonDrag(onMoveButton);
  return (
    <div className={styles.phone}>
      <span className={styles.phoneNotch} aria-hidden="true" />
      <div ref={ref} className={`${styles.phoneScreen} ${styles.arrangeable}`}>
        <DigitalCard content={content} preview />
      </div>
    </div>
  );
}

/** A página pública como ela fica num computador, reduzida para a coluna. */
function DesktopPreview({ content }: { content: CardContent }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.33);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / DESKTOP_WIDTH);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.browser}>
      <div className={styles.browserBar} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div ref={viewportRef} className={styles.browserViewport}>
        <div style={{ width: DESKTOP_WIDTH, zoom: scale }}>
          <div className={cardStyles.page} style={{ backgroundColor: content.backgroundColor ?? "#ffffff" }}>
            <DigitalCard content={content} preview />
          </div>
        </div>
      </div>
    </div>
  );
}
