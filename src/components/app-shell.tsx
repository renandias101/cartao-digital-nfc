import type { ReactNode } from "react";

import { IconLogout, IconUser } from "@/components/icons";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";

function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid shrink-0 place-items-center rounded-xl border-2 border-gold text-gold ${
          compacta ? "size-9" : "size-11"
        }`}
      >
        <IconUser className={compacta ? "size-5" : "size-6"} />
      </span>
      <span
        className={`font-semibold leading-tight text-sidebar-foreground ${
          compacta ? "text-sm" : "text-[0.9375rem]"
        }`}
      >
        Cartão de Visita Digital
      </span>
    </div>
  );
}

/**
 * Estrutura visual das áreas logadas (cliente e administrador): sidebar
 * grafite no desktop largo; barra no topo com a navegação logo abaixo em
 * tablet e celular. Só aparência — cada página continua conferindo sozinha
 * quem pode vê-la (D7), e os itens de navegação são as rotas que já existem.
 */
export function AppShell({
  nav,
  logoutAction,
  children,
}: {
  nav: NavItem[];
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const sair = (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
      >
        <IconLogout className="size-5 shrink-0" />
        Sair
      </button>
    </form>
  );

  return (
    <div className="min-h-dvh bg-canvas xl:flex">
      <aside className="hidden w-64 shrink-0 bg-sidebar xl:block">
        <div className="sticky top-0 flex h-dvh flex-col px-4 py-7">
          <div className="px-2">
            <Marca />
          </div>
          <SidebarNav items={nav} className="mt-10 flex flex-col gap-1.5" />
          <div className="mt-auto border-t border-white/10 pt-4">{sair}</div>
        </div>
      </aside>

      <header className="bg-sidebar xl:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <Marca compacta />
          <div className="shrink-0">{sair}</div>
        </div>
        <SidebarNav
          items={nav}
          className="flex gap-1 overflow-x-auto px-2 pb-2 pt-2 sm:px-4"
          horizontal
        />
      </header>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
