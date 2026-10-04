"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Painel flutuante preso a um botão, com a Popover API nativa: camada
 * superior (não é cortado por `overflow`), fecha no Esc e no clique fora e
 * devolve o foco ao botão. Aqui só se calcula a posição — abaixo do botão,
 * ou acima quando não cabe — e se fecha ao rolar, para não ficar solto.
 */
export function AnchoredPopover({
  role,
  label,
  triggerLabel,
  triggerClassName,
  triggerContent,
  align = "end",
  className = "",
  onOpen,
  children,
}: {
  role: "menu" | "dialog";
  /** Nome acessível do painel. */
  label: string;
  /** `aria-label` do botão, quando o conteúdo dele não diz o que faz. */
  triggerLabel?: string;
  triggerClassName: string;
  triggerContent: ReactNode;
  align?: "start" | "end";
  className?: string;
  onOpen?: (panel: HTMLElement) => void;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onOpenRef = useRef(onOpen);
  useLayoutEffect(() => {
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const anchor = triggerRef.current;
    if (!panel || !anchor) return;
    const hide = () => panel.hidePopover();

    function place() {
      if (!panel || !anchor) return;
      const a = anchor.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const gap = 6;
      const margin = 8;
      let top = a.bottom + gap;
      if (top + p.height > window.innerHeight - margin && a.top - p.height - gap > margin) {
        top = a.top - p.height - gap;
      }
      let left = align === "end" ? a.right - p.width : a.left;
      left = Math.min(Math.max(left, margin), window.innerWidth - p.width - margin);
      panel.style.top = `${Math.round(top)}px`;
      panel.style.left = `${Math.round(left)}px`;
    }

    function onScroll(event: Event) {
      if (event.target instanceof Node && panel?.contains(event.target)) return;
      hide();
    }

    function onToggle(event: Event) {
      const isOpen = (event as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) {
        place();
        if (panel) onOpenRef.current?.(panel);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", hide);
      } else {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", hide);
      }
    }

    panel.addEventListener("toggle", onToggle);
    return () => {
      panel.removeEventListener("toggle", onToggle);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [align]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-haspopup={role}
        aria-expanded={open}
        aria-controls={id}
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      <div
        ref={panelRef}
        id={id}
        popover="auto"
        role={role}
        aria-label={label}
        className={`fixed inset-auto m-0 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-lg ${className}`}
      >
        {children}
      </div>
    </>
  );
}

/** Fecha o painel que contém `element` (ex.: depois de escolher um item do menu). */
export function closeEnclosingPopover(element: Element) {
  element.closest<HTMLElement>("[popover]")?.hidePopover();
}
