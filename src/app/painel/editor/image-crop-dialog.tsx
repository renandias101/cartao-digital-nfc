"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const MAX_ZOOM = 4;
const FRAME_MAX = { width: 280, height: 340 };
const KEY_STEP = 12;

/** Moldura (px na tela) com a proporção pedida, cabendo em `FRAME_MAX`. */
function frameSize(aspect: number) {
  const width = Math.min(FRAME_MAX.width, FRAME_MAX.height * aspect);
  return { width, height: width / aspect };
}

type Offset = { x: number; y: number };

/**
 * Enquadramento da imagem antes do envio: arrastar move, o controle de zoom
 * (ou + / -) aproxima. A imagem sempre cobre a moldura, então nunca sobra
 * borda vazia. O recorte é feito aqui, em canvas; o servidor continua
 * validando e reprocessando o arquivo como qualquer outro upload.
 *
 * Se o navegador não conseguir abrir a imagem (`onUnreadable`), quem chamou
 * envia o arquivo original — a validação de verdade é a do servidor.
 */
export function ImageCropDialog({
  file,
  title,
  aspect,
  round = false,
  outputWidth,
  onConfirm,
  onCancel,
  onUnreadable,
}: {
  file: File;
  title: string;
  /** Largura ÷ altura do recorte. */
  aspect: number;
  /** Mostra a moldura circular (foto de perfil). */
  round?: boolean;
  /** Largura máxima, em px, do arquivo gerado. */
  outputWidth: number;
  onConfirm: (cropped: File) => void;
  onCancel: () => void;
  onUnreadable: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const onUnreadableRef = useRef(onUnreadable);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const zoomId = useId();
  const frame = frameSize(aspect);

  useEffect(() => {
    onUnreadableRef.current = onUnreadable;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let ativo = true;
    img.onload = () => {
      if (ativo) setImage(img);
    };
    img.onerror = () => {
      if (ativo) onUnreadableRef.current();
    };
    img.src = url;
    return () => {
      ativo = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Imagem que cobre a moldura no zoom 1; `scale` é px da tela por px da imagem.
  const baseScale = image ? Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight) : 1;
  const scale = baseScale * zoom;
  const shownWidth = image ? image.naturalWidth * scale : 0;
  const shownHeight = image ? image.naturalHeight * scale : 0;

  function clamp(next: Offset, forScale = scale): Offset {
    if (!image) return next;
    const maxX = Math.max(0, (image.naturalWidth * forScale - frame.width) / 2);
    const maxY = Math.max(0, (image.naturalHeight * forScale - frame.height) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) };
  }

  function changeZoom(value: number) {
    const next = Math.min(MAX_ZOOM, Math.max(1, value));
    setZoom(next);
    // Mantém o ponto central e só reencaixa se a imagem encolheu.
    setOffset((atual) => clamp(atual, baseScale * next));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const last = dragRef.current;
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setOffset((atual) => clamp({ x: atual.x + dx, y: atual.y + dy }));
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: KEY_STEP, y: 0 },
      ArrowRight: { x: -KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: KEY_STEP },
      ArrowDown: { x: 0, y: -KEY_STEP },
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setOffset((atual) => clamp({ x: atual.x + move.x, y: atual.y + move.y }));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoom(zoom + 0.2);
    } else if (event.key === "-") {
      event.preventDefault();
      changeZoom(zoom - 0.2);
    }
  }

  function confirmar() {
    if (!image) return;
    // Área da imagem original que está dentro da moldura.
    const sw = frame.width / scale;
    const sh = frame.height / scale;
    const sx = (image.naturalWidth - sw) / 2 - offset.x / scale;
    const sy = (image.naturalHeight - sh) / 2 - offset.y / scale;
    const width = Math.max(1, Math.round(Math.min(outputWidth, sw)));
    const height = Math.max(1, Math.round(width / aspect));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      onUnreadable();
      return;
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onUnreadable();
          return;
        }
        const base = file.name.replace(/\.[^.]+$/, "") || "imagem";
        onConfirm(new File([blob], `${base}.${type === "image/png" ? "png" : "jpg"}`, { type }));
      },
      type,
      0.92,
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Arraste a imagem para enquadrar e use o zoom para aproximar.</p>
        </div>

        <div
          role="group"
          tabIndex={0}
          aria-label="Área de enquadramento. Use as setas para mover e + ou - para o zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          style={{
            width: frame.width,
            height: frame.height,
            touchAction: "none",
            cursor: dragging ? "grabbing" : "grab",
          }}
          className={`relative mx-auto overflow-hidden bg-muted outline-offset-2 ring-2 ring-gold/70 ${
            round ? "rounded-full" : "rounded-xl"
          }`}
        >
          {image ? (
            // Prévia do próprio arquivo escolhido (blob local): `next/image` não se aplica.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                maxWidth: "none",
                width: shownWidth,
                height: shownHeight,
                left: (frame.width - shownWidth) / 2 + offset.x,
                top: (frame.height - shownHeight) / 2 + offset.y,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          ) : (
            <p className="grid h-full place-items-center text-sm text-muted-foreground">Carregando…</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor={zoomId} className="text-sm font-medium">
            Zoom
          </label>
          <input
            id={zoomId}
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!image}
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="min-w-0 flex-1 accent-[var(--primary)]"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="ui-btn ui-btn-outline">
            Cancelar
          </button>
          <button type="button" data-crop-confirm disabled={!image} onClick={confirmar} className="ui-btn ui-btn-primary">
            Usar esta imagem
          </button>
        </div>
      </div>
    </dialog>
  );
}
