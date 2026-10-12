import Link from "next/link";
import { redirect } from "next/navigation";

import { PasswordRequestActions } from "@/app/admin/senhas/password-request-actions";
import { IconLock } from "@/components/icons";
import { listPasswordResetRequests } from "@/lib/admin/password-reset-requests";
import { getActor } from "@/lib/auth/session";
import { formatarDataHora } from "@/lib/format";
import { normalizarPagina } from "@/lib/pagination";

export default async function PasswordRequestsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor.logado) redirect("/login");
  if (!actor.isAdmin) redirect(actor.requiresMfa ? "/mfa" : "/painel");
  const sp = await props.searchParams;
  const status = sp.status === "finished" ? "finished" : "pending";
  const page = normalizarPagina(sp.pagina);
  const result = await listPasswordResetRequests({ status, page });
  if (result && page > result.totalPages) redirect(`/admin/senhas?status=${status}&pagina=${result.totalPages}`);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><IconLock className="size-6 text-gold" /> Pedidos de senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pedidos enviados pela tela de entrada. A nova senha deve ser informada ao cliente por um canal seguro.</p>
      </header>
      <nav aria-label="Filtrar pedidos de senha" className="flex gap-2 text-sm">
        <Link href="/admin/senhas?status=pending" aria-current={status === "pending" ? "page" : undefined} className="ui-btn ui-btn-outline">Pendentes</Link>
        <Link href="/admin/senhas?status=finished" aria-current={status === "finished" ? "page" : undefined} className="ui-btn ui-btn-outline">Finalizados</Link>
      </nav>
      {!result ? <p role="alert" className="ui-card p-5 text-sm text-destructive">Não foi possível carregar os pedidos.</p>
        : result.requests.length === 0 ? <p className="ui-card p-8 text-center text-sm text-muted-foreground">Nenhum pedido nesta lista.</p>
        : <ul className="flex flex-col gap-3">{result.requests.map((request) => (
          <li key={request.id} className="ui-card flex flex-col gap-4 p-5">
            <div className="flex flex-wrap justify-between gap-2">
              <div><p className="font-semibold">{request.clientName}</p><p className="text-sm text-muted-foreground">@{request.username}</p></div>
              <time className="text-xs text-muted-foreground" dateTime={request.requestedAt}>{formatarDataHora(request.requestedAt)}</time>
            </div>
            {request.status === "pending" ? <PasswordRequestActions id={request.id} /> : (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Resultado</dt><dd>{request.result === "password_reset" ? "Senha redefinida" : "Encerrado sem redefinição"}</dd></div>
                <div><dt className="text-muted-foreground">Atendido em</dt><dd>{request.handledAt ? formatarDataHora(request.handledAt) : "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Administrador responsável</dt><dd className="break-all">{request.handledBy ?? "—"}</dd></div>
                {request.reason ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Motivo</dt><dd className="whitespace-pre-wrap">{request.reason}</dd></div> : null}
              </dl>
            )}
          </li>
        ))}</ul>}
      {result && result.totalPages > 1 ? <nav aria-label="Paginação dos pedidos de senha" className="flex items-center justify-between text-sm">
        <span>Página {page} de {result.totalPages}</span><div className="flex gap-2">
          {page > 1 ? <Link className="ui-btn ui-btn-outline" href={`/admin/senhas?status=${status}&pagina=${page - 1}`}>Anterior</Link> : null}
          {page < result.totalPages ? <Link className="ui-btn ui-btn-outline" href={`/admin/senhas?status=${status}&pagina=${page + 1}`}>Próxima</Link> : null}
        </div>
      </nav> : null}
    </main>
  );
}
