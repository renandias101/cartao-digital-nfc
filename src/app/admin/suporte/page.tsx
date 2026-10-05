import Link from "next/link";
import { redirect } from "next/navigation";

import { alterarStatusSuporteAction, classificarSuporteAction } from "@/app/admin/suporte/actions";
import { IconAlert, IconCheck, IconEdit, IconExternal, IconHelp, IconUndo, IconUser } from "@/components/icons";
import { getActor } from "@/lib/auth/session";
import { urlPublicaDoCartao } from "@/lib/env";
import { formatarDataHora } from "@/lib/format";
import { CATEGORIAS_SUPORTE } from "@/lib/support/categories";
import { contarPedidosAbertos, listarPedidosSuporte } from "@/lib/support/support-server";

const ABAS = [
  { valor: "open", rotulo: "Abertos" },
  { valor: "resolved", rotulo: "Resolvidos" },
] as const;

/**
 * Pedidos enviados pelo balão de suporte do editor do cliente. Prioridade
 * alta primeiro. O texto do cliente é exibido como texto puro (React
 * escapa). Classificação, prioridade e anotação são só do administrador.
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
              <li
                key={pedido.id}
                className={`ui-card flex flex-col gap-3 p-4 sm:p-5 ${pedido.priority === "alta" ? "border-destructive/40" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      pedido.categoria === "erro" ? "bg-destructive/10 text-destructive" : "bg-accent-soft text-foreground"
                    }`}
                  >
                    {erro ? <IconAlert className="size-3.5" /> : <IconHelp className="size-3.5" />}
                    {pedido.categoriaRotulo}
                  </span>
                  {pedido.priority === "alta" ? (
                    <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-white">Prioridade alta</span>
                  ) : null}
                  {pedido.cliente ? (
                    <span className="font-medium">
                      {pedido.cliente.nome} <span className="text-muted-foreground">@{pedido.cliente.username}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Cliente excluído</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{formatarDataHora(pedido.createdAt)}</span>
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
                  {pedido.adminNote ? (
                    <div className="rounded-lg bg-muted/60 px-3 py-2">
                      <dt className="text-xs font-medium text-muted-foreground">Anotação interna</dt>
                      <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{pedido.adminNote}</dd>
                    </div>
                  ) : null}
                </dl>

                {pedido.cliente ? (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/clientes/${pedido.cliente.username}`} className="ui-btn ui-btn-ghost ui-btn-sm">
                      <IconUser />
                      Ver cliente
                    </Link>
                    <a href={urlPublicaDoCartao(pedido.cliente.username)} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-ghost ui-btn-sm">
                      <IconExternal />
                      Abrir cartão
                    </a>
                    <Link href={`/admin/clientes/${pedido.cliente.username}/cartao`} className="ui-btn ui-btn-ghost ui-btn-sm">
                      <IconEdit />
                      Editar cartão
                    </Link>
                  </div>
                ) : null}

                <details className="rounded-xl border border-border px-3 py-2 text-sm">
                  <summary className="cursor-pointer py-1 font-medium">Atendimento (uso interno)</summary>
                  <form action={classificarSuporteAction.bind(null, pedido.id)} className="flex flex-col gap-3 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label htmlFor={`categoria-${pedido.id}`} className="ui-label">Classificação</label>
                        <select id={`categoria-${pedido.id}`} name="categoria" defaultValue={pedido.categoria} className="ui-input">
                          {CATEGORIAS_SUPORTE.map((c) => (
                            <option key={c.valor} value={c.valor}>{c.rotulo}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`prioridade-${pedido.id}`} className="ui-label">Prioridade</label>
                        <select id={`prioridade-${pedido.id}`} name="prioridade" defaultValue={pedido.priority} className="ui-input">
                          <option value="normal">Normal</option>
                          <option value="alta">Alta</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor={`anotacao-${pedido.id}`} className="ui-label">Anotação interna</label>
                      <textarea id={`anotacao-${pedido.id}`} name="anotacao" rows={2} maxLength={2000}
                        defaultValue={pedido.adminNote ?? ""} className="ui-input" />
                      <p className="ui-hint">Nunca aparece para o cliente.</p>
                    </div>
                    <button type="submit" className="ui-btn ui-btn-outline ui-btn-sm w-fit">Salvar atendimento</button>
                  </form>
                </details>

                <form action={alterarStatusSuporteAction.bind(null, pedido.id, pedido.status === "open")}>
                  <button type="submit" className="ui-btn ui-btn-outline ui-btn-sm">
                    {pedido.status === "open" ? <IconCheck /> : <IconUndo />}
                    {pedido.status === "open" ? "Marcar como resolvido" : "Reabrir"}
                  </button>
                  {pedido.resolvedAt ? (
                    <span className="ml-3 text-xs text-muted-foreground">Resolvido em {formatarDataHora(pedido.resolvedAt)}</span>
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
