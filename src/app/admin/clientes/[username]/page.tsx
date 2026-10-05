import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CancelButton,
  DeleteSection,
  EditNameForm,
  NotesForm,
  RenewForm,
  ResetPasswordForm,
} from "@/app/admin/clientes/[username]/client-actions";
import { CopyButton } from "@/components/copy-button";
import {
  IconAlert,
  IconArrowLeft,
  IconCard,
  IconClock,
  IconExternal,
  IconHelp,
  IconLock,
  IconNote,
  IconRefresh,
  IconTrash,
  IconUser,
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
import { listarPedidosSuporte } from "@/lib/support/support-server";

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
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Belem" });
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Belem" });
}

/** Complemento do histórico a partir do `detail` gravado pelo banco. */
function detalheDoHistorico(action: string, detail: unknown): string | null {
  const d = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
  if (action === "renewed" && typeof d.months === "number") {
    const novo = typeof d.new_expires_at === "string" ? ` — novo vencimento ${dataCurta(d.new_expires_at)}` : "";
    return `${d.months} meses${novo}`;
  }
  if (action === "client_created" && typeof d.package_months === "number") return `pacote de ${d.package_months} meses`;
  if (action === "client_updated" && d.campo === "full_name") return "nome do cliente";
  return null;
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

  const [observacoes, historico, atividade, pedidos] = await Promise.all([
    buscarObservacoes(cliente.id),
    historicoDoCliente(cliente.username),
    buscarAtividadeDoCartao(cliente.id),
    listarPedidosSuporte({ clientId: cliente.id, limite: 10 }),
  ]);
  const urlCartao = urlPublicaDoCartao(cliente.username);

  const diasTexto =
    cliente.status === "active"
      ? cliente.days_until_expiry >= 0
        ? `vence em ${cliente.days_until_expiry} dia(s)`
        : "vencimento hoje"
      : cliente.status === "expired"
        ? `vencido há ${Math.abs(cliente.days_until_expiry)} dia(s)`
        : "cancelado";

  const assinatura = [
    { rotulo: "Situação", valor: diasTexto },
    { rotulo: "Vencimento", valor: formatarData(cliente.expires_at) },
    { rotulo: "Pacote atual", valor: `${cliente.package_months} meses` },
    { rotulo: "Última renovação", valor: cliente.last_renewed_at ? formatarData(cliente.last_renewed_at) : "—" },
    { rotulo: "Cliente desde", valor: dataCurta(cliente.created_at) },
  ];
  const cartao = [
    {
      rotulo: "Última publicação",
      valor: atividade.ultimaPublicacao ? formatarData(atividade.ultimaPublicacao) : "nunca publicou",
    },
    { rotulo: "Última edição do rascunho", valor: atividade.ultimaEdicao ? formatarData(atividade.ultimaEdicao) : "—" },
    {
      rotulo: "Visível ao público",
      valor:
        cliente.status !== "active"
          ? "não — página neutra (fora do ar)"
          : atividade.ultimaPublicacao
            ? "sim"
            : "não — ainda não publicado",
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
        <div className="flex flex-wrap gap-2">
          <a href={urlCartao} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-outline ui-btn-sm">
            <IconExternal />
            Abrir cartão
          </a>
          <CopyButton value={urlCartao} label="Copiar link do cartão" className="ui-btn ui-btn-outline ui-btn-sm" />
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="ui-card-title">
            <IconClock />
            Assinatura
          </h2>
          <dl className="grid gap-y-3 text-sm">
            {assinatura.map((item) => (
              <div key={item.rotulo} className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-muted-foreground">{item.rotulo}</dt>
                <dd className="font-medium">{item.valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="ui-card-title">
            <IconCard />
            Cartão
          </h2>
          <dl className="grid gap-y-3 text-sm">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Endereço gravado no NFC</dt>
              <dd className="font-medium break-all">
                <a href={urlCartao} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                  {urlCartao}
                </a>
              </dd>
            </div>
            {cartao.map((item) => (
              <div key={item.rotulo} className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-muted-foreground">{item.rotulo}</dt>
                <dd className="font-medium">{item.valor}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="ui-card-title">
          <IconUser />
          Dados do cliente
        </h2>
        <EditNameForm clientId={cliente.id} username={cliente.username} nomeAtual={cliente.full_name} />
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
        <section id="cancelar" className="ui-card flex scroll-mt-6 flex-col gap-4 p-5 sm:p-6">
          <div>
            <h2 className="ui-card-title">
              <IconAlert />
              Cancelar
            </h2>
            <p className="ui-hint mt-1">
              Tira o cartão do ar na hora: o visitante passa a ver a página neutra. Dá para reativar depois,
              renovando o cliente.
            </p>
          </div>
          <CancelButton clientId={cliente.id} username={cliente.username} />
        </section>
      ) : null}

      <section className="ui-card flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="ui-card-title">
            <IconHelp />
            Suporte
          </h2>
          <Link href="/admin/suporte" className="text-sm font-medium hover:text-primary hover:underline">
            Ver todos os pedidos
          </Link>
        </div>
        {pedidos === null ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar os pedidos.</p>
        ) : pedidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido de suporte deste cliente.</p>
        ) : (
          <ul className="flex flex-col text-sm">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-x-4">
                  <span className="font-medium">
                    {pedido.kind === "error" ? "Erro" : "Ajuda"}
                    <span className={pedido.status === "open" ? "text-gold" : "text-muted-foreground"}>
                      {" · "}
                      {pedido.status === "open" ? "aberto" : "resolvido"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">{formatarData(pedido.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-muted-foreground [overflow-wrap:anywhere]">{pedido.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                <span className="font-medium">
                  {NOMES_ACAO[item.action] ?? item.action}
                  {detalheDoHistorico(item.action, item.detail) ? (
                    <span className="font-normal text-muted-foreground">
                      {" — "}
                      {detalheDoHistorico(item.action, item.detail)}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">{formatarData(item.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sempre visível; a exclusão em si só vale para cliente cancelado (PRD §34,
          critério §66), regra que o banco também impõe na política de delete. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-destructive/25 bg-card p-5 sm:p-6">
        <h2 className="ui-card-title text-destructive">
          <IconTrash className="text-destructive" />
          Excluir cliente
        </h2>
        {cliente.status === "cancelled" ? (
          <DeleteSection clientId={cliente.id} />
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Para excluir, cancele o cliente primeiro: só clientes cancelados podem ser excluídos. Isso evita
              apagar por engano um cartão que está no ar.
            </p>
            <a href="#cancelar" className="ui-btn ui-btn-outline ui-btn-sm w-fit">
              Ir para Cancelar
            </a>
          </div>
        )}
        <p className="ui-hint">
          A exclusão apaga a conta, o cartão, as imagens e as observações. O nome de usuário @{cliente.username}
          fica reservado: o NFC continua levando à página neutra, e a URL não pode ser usada por outro cliente.
        </p>
      </section>
    </main>
  );
}
