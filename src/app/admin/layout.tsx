import { logoutAction } from "@/app/admin/actions";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Clientes",
    icon: "users",
    activePrefixes: ["/admin/clientes/"],
    exclude: ["/admin/clientes/novo"],
  },
  { href: "/admin/clientes/novo", label: "Novo cliente", icon: "userPlus" },
];

/** Moldura visual da área administrativa. Autorização continua em cada página. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell nav={NAV} logoutAction={logoutAction}>
      {children}
    </AppShell>
  );
}
