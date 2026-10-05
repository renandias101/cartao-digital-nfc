import Link from "next/link";
import { redirect } from "next/navigation";

import { alterarStatusSuporteAction } from "@/app/admin/suporte/actions";
import { IconAlert, IconCheck, IconHelp, IconUndo } from "@/components/icons";
import { getActor } from "@/lib/auth/session";
import { contarPedidosAbertos, listarPedidosSuporte } from "@/lib/support/support-server";

const ABAS = [
  { valor: "open", rotulo: "Abertos" },
  { valor: "resolved", rotulo: "Resolvidos" },
] as const;

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Belem",
  });
}

/**
 * Pedidos enviados pelo balão de suporte do editor do cliente. Texto do
 * cliente é exibido como texto puro (React escapa), com as quebras de linha.
 */
export default async function AdminSuportePage(props: PageProps<"/admin/suporte">) {
  const actor = await getActor();
  if (!actor.logado) redirect("/login");
  if (!actor.isAdmin) redirect("/painel");

  const sp = await props.searchParams;
  const status = sp.status === "resolved" ? "resolved" : "open";
  const [pedidos, abertos] = await Promise.all([listarPedidosSuporte({ status }), contarPedidosAbertos()]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suporte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Erros e pedidos de ajuda enviados pelos clientes no editor do cartão.
        </p>
      </div>

      <nav aria-label="Filtrar pedidos" className="flex flex-wrap gap-2 text-sm">
        {ABAS.map((aba) => {
          const ativa = status === aba.valor;
          return (
            <Link
              key={aba.valor}
              href={`/admin/suporte?status=${aba.valor}`}
              aria-current={ativa ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full border px-3.5 font-medium transition-colors ${
                ativa
                  ? "border-sidebar bg-sidebar text-sidebar-foreground"
                  : "border-input bg-card text-zinc-600 hover:bg-muted hover:text-foreground"
              }`}
            >
              {aba.rotulo}
              {aba.valor === "open" && abertos > 0 ? ` (${abertos})` : ""}
            </Link>
          );
        })}
      </nav>

      {pedidos === null ? (
        <p role="alert" className="ui-card p-5 text-sm text-muted-foreground">
          Não foi possível carregar os pedidos. Tente novamente.
        </p>
      ) : pedidos.length === 0 ? (
        <p className="ui-card p-8 text-center text-sm text-muted-foreground">
          {status === "open" ? "Nenhum pedido aberto." : "Nenhum pedido resolvido ainda."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((pedido) => {
            const erro = pedido.kind === "error";
            return (
              <li key={pedido.id} className="ui-card flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      erro ? "bg-destructive/10 text-destructive" : "bg-accent-soft text-foreground"
                    }`}
                  >
                    {erro ? <IconAlert className="size-3.5" /> : <IconHelp className="size-3.5" />}
                    {erro ? "Erro" : "Ajuda"}
                  </span>
                  {pedido.cliente ? (
                    <Link
                      href={`/admin/clientes/${pedido.cliente.username}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {pedido.cliente.nome} <span className="text-muted-foreground">@{pedido.cliente.username}</span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Cliente excluído</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{dataHora(pedido.createdAt)}</span>
                </div>

                <dl className="flex flex-col gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {erro ? "O que estava tentando fazer" : "O que precisa"}
                    </dt>
                    <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{pedido.message}</dd>
                  </div>
                  {erro && pedido.errorText ? (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Erro que apareceu</dt>
                      <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{pedido.errorText}</dd>
                    </div>
                  ) : null}
                </dl>

                <form action={alterarStatusSuporteAction.bind(null, pedido.id, pedido.status === "open")}>
                  <button type="submit" className="ui-btn ui-btn-outline ui-btn-sm">
                    {pedido.status === "open" ? <IconCheck /> : <IconUndo />}
                    {pedido.status === "open" ? "Marcar como resolvido" : "Reabrir"}
                  </button>
                  {pedido.resolvedAt ? (
                    <span className="ml-3 text-xs text-muted-foreground">Resolvido em {dataHora(pedido.resolvedAt)}</span>
                  ) : null}
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
