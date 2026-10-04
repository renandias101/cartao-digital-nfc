const ESTILOS: Record<string, string> = {
  active: "bg-success-soft text-success",
  expired: "bg-warning-soft text-warning",
  // zinc-600 em vez de `muted-foreground`: sobre o fundo cinza do selo, o
  // tom padrão fica abaixo de 4.5:1.
  cancelled: "bg-muted text-zinc-600",
};

/**
 * Selo de status para o painel (cliente e administrador) — nunca usado na
 * página pública, onde o status não pode aparecer. O texto sempre acompanha
 * a cor: a informação não depende só dela.
 */
export function StatusBadge({
  status,
  label,
  className = "px-2.5 py-0.5 text-xs",
}: {
  status: string;
  label: string;
  /** Tamanho; a cor continua vindo do status. */
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${className} ${
        ESTILOS[status] ?? "bg-muted text-zinc-600"
      }`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
