import type { EstadoCartao } from "@/lib/admin/clients";

export const ROTULO_ESTADO_CARTAO: Record<EstadoCartao, string> = {
  up_to_date: "Atualizado",
  pending_changes: "Alterações não publicadas",
  never_published: "Nunca publicado",
};

const ESTILOS: Record<EstadoCartao, string> = {
  up_to_date: "bg-success-soft text-success",
  pending_changes: "bg-warning-soft text-warning",
  never_published: "bg-muted text-zinc-600",
};

/** Estado do cartão no painel administrativo. O texto acompanha a cor. */
export function CardStateBadge({ estado }: { estado: EstadoCartao }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTILOS[estado]}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {ROTULO_ESTADO_CARTAO[estado]}
    </span>
  );
}
