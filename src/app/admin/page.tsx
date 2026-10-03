import Link from "next/link";

import { redirect } from "next/navigation";

import { IconSearch, IconUserPlus } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { listarClientes, type FiltroAdmin } from "@/lib/admin/clients";
import { getActor } from "@/lib/auth/session";

const FILTROS: { valor: FiltroAdmin; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "vence_em_15_dias", rotulo: "Vencem em até 15 dias" },
  { valor: "vencidos", rotulo: "Vencidos" },
  { valor: "cancelados", rotulo: "Cancelados" },
];

const NOMES_STATUS: Record<string, string> = {
  active: "Ativo",
  expired: "Vencido",
  cancelled: "Cancelado",
};

function montarQuery(base: Record<string, string>, sobrescrever: Record<string, string>) {
  const params = new URLSearchParams({ ...base, ...sobrescrever });
  for (const [chave, valor] of Object.entries(sobrescrever)) {
    if (!valor) params.delete(chave);
  }
  return params.toString();
}

/**
 * Painel administrativo: listagem com filtro, busca e paginação (PRD §35 a §38).
 *
 * Tudo por link e formulário GET, sem componente de cliente — cada mudança
 * de filtro/busca/página é uma navegação normal, com a URL guardando o
 * estado. Simples e rápido (PRD §51-§52), sem justificar interatividade de
 * cliente para uma tela de uso interno. "Sair" fica na sidebar
 * (`admin/layout.tsx`).
 */
export default async function AdminPage(props: PageProps<"/admin">) {
  const actor = await getActor();
  if (!actor.logado) {
    redirect("/login");
  }
  if (!actor.isAdmin) {
    redirect("/painel");
  }

  const sp = await props.searchParams;
  const filtro = (typeof sp.filtro === "string" ? sp.filtro : "todos") as FiltroAdmin;
  const busca = typeof sp.busca === "string" ? sp.busca : "";
  const pagina = Number(sp.pagina) || 1;

  const { clientes, total, totalPaginas } = await listarClientes({ filtro, busca, pagina });

  const baseQuery = { filtro, busca, pagina: String(pagina) };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Painel administrativo</h1>
        <Link href="/admin/clientes/novo" className="ui-btn ui-btn-primary">
          <IconUserPlus />
          Novo cliente
        </Link>
      </header>

      <div className="ui-card flex flex-col gap-4 p-4 sm:p-5">
        <nav aria-label="Filtrar clientes" className="flex flex-wrap gap-2 text-sm">
          {FILTROS.map((f) => {
            const ativo = filtro === f.valor;
            return (
              <Link
                key={f.valor}
                href={`/admin?${montarQuery(baseQuery, { filtro: f.valor, pagina: "1" })}`}
                aria-current={ativo ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3.5 font-medium transition-colors ${
                  ativo
                    ? "border-sidebar bg-sidebar text-sidebar-foreground"
                    : "border-input bg-card text-zinc-600 hover:bg-muted hover:text-foreground"
                }`}
              >
                {f.rotulo}
              </Link>
            );
          })}
        </nav>

        <form action="/admin" method="get" role="search" className="flex gap-2">
          <input type="hidden" name="filtro" value={filtro} />
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="busca"
              defaultValue={busca}
              placeholder="Buscar por nome ou usuário…"
              aria-label="Buscar por nome ou usuário"
              className="ui-input pl-9"
            />
          </div>
          <button type="submit" className="ui-btn ui-btn-outline">
            Buscar
          </button>
        </form>
      </div>

      {clientes.length === 0 ? (
        <p className="ui-card p-8 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado.
        </p>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <th scope="col" className="px-5 py-3">Nome</th>
                  <th scope="col" className="px-5 py-3">Usuário</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/50"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/clientes/${c.username}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">@{c.username}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={c.status} label={NOMES_STATUS[c.status] ?? c.status} />
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {c.status === "active" ? `${c.days_until_expiry} dia(s)` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPaginas > 1 ? (
        <nav
          aria-label="Paginação"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span className="text-zinc-600">
            {total} cliente(s) — página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 ? (
              <Link
                href={`/admin?${montarQuery(baseQuery, { pagina: String(pagina - 1) })}`}
                className="ui-btn ui-btn-outline ui-btn-sm"
              >
                Anterior
              </Link>
            ) : null}
            {pagina < totalPaginas ? (
              <Link
                href={`/admin?${montarQuery(baseQuery, { pagina: String(pagina + 1) })}`}
                className="ui-btn ui-btn-outline ui-btn-sm"
              >
                Próxima
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
