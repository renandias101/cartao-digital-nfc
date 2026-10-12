import Link from "next/link";
import { redirect } from "next/navigation";

import { SupportClassificationForm, SupportStatusForm } from "@/app/admin/suporte/support-request-actions";
import { IconAlert, IconEdit, IconExternal, IconHelp, IconUser } from "@/components/icons";
import { getActor } from "@/lib/auth/session";
import { urlPublicaDoCartao } from "@/lib/env";
import { formatarDataHora } from "@/lib/format";
import { normalizarPagina } from "@/lib/pagination";
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
  if (!actor.isAdmin) redirect(actor.requiresMfa ? "/mfa" : "/painel");

  const sp = await props.searchParams;
  const status = sp.status === "resolved" ? "resolved" : "open";
  const paginaBruta = typeof sp.pagina === "string" ? Number(sp.pagina) : 1;
  const pagina = normalizarPagina(sp.pagina);
  const [resultado, abertos] = await Promise.all([listarPedidosSuporte({ status, pagina }), contarPedidosAbertos()]);
  if (resultado && ((typeof sp.pagina === "string" && paginaBruta !== pagina) || pagina > resultado.totalPaginas)) {
    redirect(`/admin/suporte?status=${status}&pagina=${Math.min(pagina, resultado.totalPaginas)}`);
  }
  const pedidos = resultado?.pedidos ?? null;

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
              {aba.valor === "open" && abertos !== null && abertos > 0 ? ` (${abertos})` : ""}
            </Link>
          );
        })}
      </nav>

      {abertos === null ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar a contagem de pedidos abertos. A lista abaixo continua disponível.
        </p>
      ) : null}

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
                  <SupportClassificationForm id={pedido.id} categoria={pedido.categoria} prioridade={pedido.priority} anotacao={pedido.adminNote} />
                </details>

                <div>
                  <SupportStatusForm id={pedido.id} resolvido={pedido.status === "open"} />
                  {pedido.resolvedAt ? (
                    <span className="ml-3 text-xs text-muted-foreground">Resolvido em {formatarDataHora(pedido.resolvedAt)}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {resultado && resultado.totalPaginas > 1 ? (
        <nav aria-label="Paginação do suporte" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-zinc-600">{resultado.total} pedido(s) — página {pagina} de {resultado.totalPaginas}</span>
          <div className="flex gap-2">
            {pagina > 1 ? <Link href={`/admin/suporte?status=${status}&pagina=${pagina - 1}`} className="ui-btn ui-btn-outline ui-btn-sm">Anterior</Link> : null}
            {pagina < resultado.totalPaginas ? <Link href={`/admin/suporte?status=${status}&pagina=${pagina + 1}`} className="ui-btn ui-btn-outline ui-btn-sm">Próxima</Link> : null}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
