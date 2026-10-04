import type { ReactNode } from "react";

import { CardLinkBox } from "@/app/painel/card-link-box";
import editorStyles from "@/app/painel/editor/editor.module.css";
import { IconCalendar, IconExternal } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";

const NOMES_STATUS: Record<string, string> = {
  active: "Cartão ativo",
  expired: "Cartão vencido",
  cancelled: "Cartão cancelado",
};

/**
 * Topo da área do cliente: título, situação real do cartão (status e
 * vencimento), link público copiável e "Abrir cartão". Só aparece para o
 * próprio cliente — o status nunca vai para a página pública.
 */
export function EditorHeader({
  status,
  expiresAt,
  publicUrl,
  publicPath,
  accountAction,
}: {
  status: "active" | "expired" | "cancelled";
  /** Data já formatada (dd/mm/aaaa). */
  expiresAt: string;
  publicUrl: string;
  publicPath: string;
  /** Ação da conta (ex.: botão "Sair"). */
  accountAction?: ReactNode;
}) {
  return (
    <header className={editorStyles.editorHeader}>
      <div className={editorStyles.headerTitle}>
        <h1>Editor do cartão</h1>
        <p>Personalize as informações, aparência e links do seu cartão digital.</p>
      </div>

      <div className={editorStyles.headerMeta}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} label={NOMES_STATUS[status] ?? status} className="px-3 py-1 text-sm" />
          {status !== "cancelled" ? (
            <span className={editorStyles.metaChip}>
              <IconCalendar className="size-4 text-muted-foreground" />
              {status === "active" ? "Vencimento" : "Venceu em"}: {expiresAt}
            </span>
          ) : null}
          {accountAction ? <div className="ml-auto">{accountAction}</div> : null}
        </div>
        <div className={editorStyles.headerLinkRow}>
          <CardLinkBox url={publicUrl} />
          <a href={publicPath} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-outline shrink-0">
            <IconExternal />
            Abrir cartão
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </div>
      </div>
    </header>
  );
}
