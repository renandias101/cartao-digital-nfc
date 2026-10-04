"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ButtonLayout } from "@/lib/card/presentation";

/** Tempo segurando antes de o botão "soltar" e começar a arrastar. */
const HOLD_MS = 350;
/** Mover mais que isto antes do tempo é rolagem ou clique, não arrastar. */
const MOVE_TOLERANCE = 8;
const EDGE_SCROLL = 56;

export type DropTarget = { layout: ButtonLayout; beforeId: string | null };

/**
 * Área de soltura sob o ponteiro (a mais próxima, se nenhuma contém) e o
 * botão antes do qual o arrastado entra. Grade compara na horizontal dentro
 * da mesma linha; lista compara na vertical.
 */
function findDropTarget(root: HTMLElement, draggingId: string, x: number, y: number): DropTarget | null {
  const zones = Array.from(root.querySelectorAll<HTMLElement>("[data-button-zone]"))
    .filter((zone) => zone.getClientRects().length > 0);
  if (!zones.length) return null;
  const distance = (zone: HTMLElement) => {
    const rect = zone.getBoundingClientRect();
    return y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  };
  const zone = zones.reduce((best, current) => (distance(current) < distance(best) ? current : best));
  const layout = zone.dataset.buttonZone === "square" ? "square" : "row";
  const zoneWidth = zone.getBoundingClientRect().width;
  const before = Array.from(zone.querySelectorAll<HTMLElement>("[data-button-id]"))
    .filter((item) => item.dataset.buttonId !== draggingId)
    .find((item) => {
      const rect = item.getBoundingClientRect();
      if (y < rect.top) return true;
      if (y > rect.bottom) return false;
      const isGridCell = rect.width < zoneWidth * 0.6;
      return isGridCell ? x < rect.left + rect.width / 2 : y < rect.top + rect.height / 2;
    });
  return { layout, beforeId: before?.dataset.buttonId ?? null };
}

/**
 * Segurar um botão (`[data-button-id]`) dentro do elemento que recebe o `ref`
 * devolvido e arrastar entre
 * as áreas `[data-button-zone]`. Funciona com mouse e toque; enquanto
 * arrasta, a página não rola e o toque não abre o link. `onMove` é chamado
 * só quando o destino muda — o cartão se reorganiza ao vivo.
 */
export function useButtonDrag(
  onMove: (id: string, target: DropTarget) => void,
): (element: HTMLElement | null) => void {
  // Ref de callback: a área pode aparecer depois (primeiro botão adicionado).
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const onMoveRef = useRef(onMove);
  useLayoutEffect(() => {
    onMoveRef.current = onMove;
  });

  // Marca o botão arrastado e as áreas de soltura depois de cada render (o
  // nó do botão muda de lugar quando ele troca de área).
  useLayoutEffect(() => {
    if (!root) return;
    root.toggleAttribute("data-arranging", draggingId !== null);
    root.querySelectorAll("[data-drag-active]").forEach((el) => el.removeAttribute("data-drag-active"));
    if (draggingId) {
      root.querySelector(`[data-button-id="${CSS.escape(draggingId)}"]`)?.setAttribute("data-drag-active", "");
    }
  });

  useEffect(() => {
    if (!root) return;
    let holdTimer: number | undefined;
    let start: { x: number; y: number } | null = null;
    let id: string | null = null;
    let dragging = false;
    let lastKey = "";
    let suppressClick = false;

    function finish() {
      window.clearTimeout(holdTimer);
      start = null;
      id = null;
      dragging = false;
      setDraggingId(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("touchmove", onTouchMove);
    }

    function onTouchMove(event: TouchEvent) {
      if (dragging) event.preventDefault();
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging) {
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE) finish();
        return;
      }
      event.preventDefault();
      if (event.clientY < EDGE_SCROLL) window.scrollBy(0, -12);
      else if (event.clientY > window.innerHeight - EDGE_SCROLL) window.scrollBy(0, 12);
      const target = id && root ? findDropTarget(root, id, event.clientX, event.clientY) : null;
      if (!id || !target) return;
      const key = `${target.layout}|${target.beforeId}`;
      if (key === lastKey) return;
      lastKey = key;
      onMoveRef.current(id, target);
    }

    function onPointerUp() {
      // O clique que vem depois de soltar não pode abrir o link nem os detalhes.
      if (dragging) suppressClick = true;
      finish();
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || id) return;
      const target = event.target as Element;
      const item = target.closest<HTMLElement>("[data-button-id]");
      if (!item || !root?.contains(item)) return;
      const control = target.closest("button, input, select, textarea");
      if (control && item.contains(control)) return;
      id = item.dataset.buttonId ?? null;
      start = { x: event.clientX, y: event.clientY };
      lastKey = "";
      holdTimer = window.setTimeout(() => {
        dragging = true;
        setDraggingId(id);
        navigator.vibrate?.(15);
      }, HOLD_MS);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", finish);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
    }

    function onClick(event: MouseEvent) {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }

    // Segurar um link no celular abre o menu do sistema; arrastar um link
    // com o mouse inicia o arrastar nativo do navegador. Nenhum dos dois aqui.
    function onNativeGesture(event: Event) {
      if ((event.target as Element).closest?.("[data-button-id]")) event.preventDefault();
    }

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("click", onClick, true);
    root.addEventListener("contextmenu", onNativeGesture);
    root.addEventListener("dragstart", onNativeGesture);
    return () => {
      finish();
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("contextmenu", onNativeGesture);
      root.removeEventListener("dragstart", onNativeGesture);
    };
  }, [root]);

  return setRoot;
}
