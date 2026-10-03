"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";

/** O editor ocupa a tela; as demais páginas mantêm a navegação do painel. */
export function PainelShell({
  children,
  nav,
  logoutAction,
}: {
  children: ReactNode;
  nav: NavItem[];
  logoutAction: () => Promise<void>;
}) {
  const segment = useSelectedLayoutSegment();

  if (segment === "editor") return children;

  return <AppShell nav={nav} logoutAction={logoutAction}>{children}</AppShell>;
}
