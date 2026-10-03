import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CancelButton,
  DeleteSection,
  NotesForm,
  RenewForm,
  ResetPasswordForm,
} from "@/app/admin/clientes/[username]/client-actions";
import {
  IconAlert,
  IconArrowLeft,
  IconClock,
  IconLock,
  IconNote,
  IconRefresh,
  IconTrash,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import {
  buscarAtividadeDoCartao,
  buscarClientePorUsername,
  buscarObservacoes,
  historicoDoCliente,
} from "@/lib/admin/clients";
import { getActor } from "@/lib/auth/session";
import { urlPublicaDoCartao } from "@/lib/env";

const NOMES_STATUS: Record<string, string> = {
  active: "Ativo",
  expired: "Vencido",
  cancelled: "Cancelado",
};

const NOMES_ACAO: Record<string, string> = {
  client_created: "Cliente criado",
  password_reset: "Senha redefinida",
  renewed: "Renovado",
  cancelled: "Cancelado",
  deleted: "Excluído",
  notes_updated: "Observações atualizadas",
  client_updated: "Dados atualizados",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function DetalheClientePage(props: PageProps<"/admin/clientes/[username]">) {
  const actor = await getActor();
  if (!actor.logado) {
    redirect("/login");
  }
  if (!actor.isAdmin) {
    redirect("/painel");
  }

  const { username } = await props.params;

  const cliente = await buscarClientePorUsername(username);
  if (!cliente) {
    notFound();
  }

  const [observacoes, historico, atividade] = await Promise.all([
    buscarObservacoes(cliente.id),
    historicoDoCliente(cliente.username),
    buscarAtividadeDoCartao(cliente.id),
  ]);

  const diasTexto =
    cliente.status === "active"
      ? cliente.days_until_expiry >= 0
        ? `vence em ${cliente.days_until_expiry} dia(s)`
        : "vencimento hoje"
      : cliente.status === "expired"
        ? `vencido há ${Math.abs(cliente.days_until_expiry)} dia(s)`
        : "cancelado";

  const informacoes: { rotulo: string; valor: string; quebrar?: boolean }[] = [
    { rotulo: "Situação", valor: diasTexto },
    { rotulo: "Vencimento", valor: formatarData(cliente.expires_at) },
    { rotulo: "Pacote atual", valor: `${cliente.package_months} meses` },
    {
      rotulo: "Última renovação",
      valor: cliente.last_renewed_at ? formatarData(cliente.last_renewed_at) : "—",
    },
    { rotulo: "URL pública", valor: urlPublicaDoCartao(cliente.username), quebrar: true },
    {
      rotulo: "Última edição do cartão",
      valor: atividade.ultimaEdicao ? formatarData(atividade.ultimaEdicao) : "—",
    },
    {
      rotulo: "Última publicação",
      valor: atividade.ultimaPublicacao ? formatarData(atividade.ultimaPublicacao) : "nunca publicou",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-3">
        <Link href="/admin" className="ui-link-back w-fit">
          <IconArrowLeft />
          Voltar para a lista
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight">{cliente.full_name}</h1>
          <StatusBadge
            status={cliente.status}
            label={NOMES_STATUS[cliente.status] ?? cliente.status}
          />
        </div>
        <p className="text-sm text-zinc-600">@{cliente.username}</p>
      </header>

      <section className="ui-card p-5 sm:p-6" aria-labelledby="titulo-dados">
        <h2 id="titulo-dados" className="sr-only">
          Dados do cliente
        </h2>
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-0.5 font-medium">{NOMES_STATUS[cliente.status] ?? cliente.status}</dd>
          </div>
          {informacoes.map((item) => (
            <div key={item.rotulo} className="min-w-0">
              <dt className="text-muted-foreground">{item.rotulo}</dt>
              <dd className={`mt-0.5 font-medium ${item.quebrar ? "break-all" : ""}`}>
                {item.valor}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="ui-card-title">
            <IconRefresh />
            Renovar
          </h2>
          <RenewForm clientId={cliente.id} username={cliente.username} />
        </section>

        <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="ui-card-title">
            <IconLock />
            Redefinir senha
          </h2>
          <ResetPasswordForm clientId={cliente.id} username={cliente.username} />
        </section>
      </div>

      {cliente.status !== "cancelled" ? (
        <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="ui-card-title">
            <IconAlert />
            Cancelar
          </h2>
          <CancelButton clientId={cliente.id} username={cliente.username} />
        </section>
      ) : null}

      <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="ui-card-title">
            <IconNote />
            Observações internas
          </h2>
          <p className="ui-hint mt-1">Privadas — nunca visíveis ao cliente ou ao visitante.</p>
        </div>
        <NotesForm
          clientId={cliente.id}
          username={cliente.username}
          observacoesIniciais={observacoes}
        />
      </section>

      <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="ui-card-title">
          <IconClock />
          Histórico
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <ul className="flex flex-col text-sm">
            {historico.map((item, i) => (
              <li
                key={i}
                className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-border py-2.5 last:border-b-0"
              >
                <span className="font-medium">{NOMES_ACAO[item.action] ?? item.action}</span>
                <span className="text-muted-foreground">{formatarData(item.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cliente.status === "cancelled" ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-destructive/25 bg-card p-5 sm:p-6">
          <h2 className="ui-card-title text-destructive">
            <IconTrash className="text-destructive" />
            Excluir
          </h2>
          <DeleteSection clientId={cliente.id} />
        </section>
      ) : null}
    </main>
  );
}
