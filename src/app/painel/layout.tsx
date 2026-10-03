import { logoutAction } from "@/app/painel/actions";
import { PainelShell } from "@/app/painel/painel-shell";
import type { NavItem } from "@/components/sidebar-nav";

const NAV: NavItem[] = [
  { href: "/painel", label: "Painel", icon: "home" },
  { href: "/painel/editor", label: "Editar cartão", icon: "card" },
];

/** Moldura visual da área do cliente. Autorização continua em cada página. */
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <PainelShell nav={NAV} logoutAction={logoutAction}>
      {children}
    </PainelShell>
  );
}
