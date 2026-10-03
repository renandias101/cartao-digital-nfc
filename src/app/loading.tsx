/**
 * Estado de carregamento padrão (PRD §48): nunca deixar tela vazia nem com
 * aparência de erro enquanto algo carrega.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh items-center justify-center p-6"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2 border-border border-t-primary"
        />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    </div>
  );
}
