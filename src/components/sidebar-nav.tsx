"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconCard, IconHome, IconUserPlus, IconUsers } from "@/components/icons";

const ICONES = {
  home: IconHome,
  card: IconCard,
  users: IconUsers,
  userPlus: IconUserPlus,
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONES;
  /** Caminhos (além do próprio `href`) em que o item aparece como ativo. */
  activePrefixes?: string[];
  /** Caminhos que, mesmo casando com um prefixo, NÃO ativam o item. */
  exclude?: string[];
};

function estaAtivo(item: NavItem, pathname: string): boolean {
  if (item.exclude?.includes(pathname)) return false;
  if (pathname === item.href) return true;
  return item.activePrefixes?.some((prefixo) => pathname.startsWith(prefixo)) ?? false;
}

/** Links de navegação da sidebar; único pedaço que precisa saber a rota atual. */
export function SidebarNav({
  items,
  className,
  horizontal = false,
}: {
  items: NavItem[];
  className?: string;
  horizontal?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className={className}>
      {items.map((item) => {
        const ativo = estaAtivo(item, pathname);
        const Icone = ICONES[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
              ativo
                ? "bg-sidebar-active text-sidebar-foreground"
                : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
            } ${horizontal ? "whitespace-nowrap" : ""}`}
          >
            <Icone className={`size-5 shrink-0 ${ativo ? "text-gold" : ""}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
