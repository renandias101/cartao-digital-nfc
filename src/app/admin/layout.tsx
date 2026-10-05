import { logoutAction } from "@/app/admin/actions";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";
import { getActor } from "@/lib/auth/session";
import { contarPedidosAbertos } from "@/lib/support/support-server";

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Clientes",
    icon: "users",
    activePrefixes: ["/admin/clientes/"],
    exclude: ["/admin/clientes/novo"],
  },
  { href: "/admin/clientes/novo", label: "Novo cliente", icon: "userPlus" },
  { href: "/admin/suporte", label: "Suporte", icon: "help" },
  { href: "/admin/rodape", label: "Rodapé dos cartões", icon: "layers" },
];

/**
 * Moldura visual da área administrativa. Autorização continua em cada página.
 * O menu mostra quantos pedidos de suporte estão abertos; resolver um pedido
 * revalida este layout (`revalidatePath("/admin", "layout")`).
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const actor = await getActor();
  const abertos = actor.logado && actor.isAdmin ? await contarPedidosAbertos() : 0;
  const nav = NAV.map((item) =>
    item.href === "/admin/suporte" ? { ...item, badge: { count: abertos, label: "pedidos abertos" } } : item,
  );
  return (
    <AppShell nav={nav} logoutAction={logoutAction}>
      {children}
    </AppShell>
  );
}
