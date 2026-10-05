import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CardStateBadge } from "@/app/admin/card-state-badge";
import { CardHealthPanel } from "@/app/admin/clientes/[username]/card-health-panel";
import { CardPreviewTabs } from "@/app/admin/clientes/[username]/card-preview-tabs";
import {
  CancelButton,
  ClientDataForm,
  DeleteSection,
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
  IconEdit,
  IconExternal,
  IconHealth,
  IconHelp,
  IconLock,
  IconNote,
  IconRefresh,
  IconTrash,
  IconUser,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { avaliarSaudeDoCartao } from "@/lib/admin/card-health";
import {
  buscarClientePorUsername,
  buscarContatos,
  buscarConteudosDoCartao,
  buscarObservacoes,
  historicoDoCliente,
  listarPagamentos,
} from "@/lib/admin/clients";
import { formatarWhatsapp, linkWhatsapp } from "@/lib/admin/contacts";
import { rotuloFormaPagamento } from "@/lib/admin/payments";
import { getActor } from "@/lib/auth/session";
import { urlPublicaDoCartao } from "@/lib/env";
import { dias, diasAte, formatarCentavos, formatarData, formatarDataHora } from "@/lib/format";
import { listarPedidosSuporte } from "@/lib/support/support-server";
import { getCardFooter } from "@/lib/system/card-footer-server";

const NOMES_STATUS: Record<string, string> = { active: "Ativo", expired: "Vencido", cancelled: "Cancelado" };

const NOMES_ACAO: Record<string, string> = {
  client_created: "Cliente criado",
  password_reset: "Senha redefinida",
  renewed: "Renovado",
  cancelled: "Cancelado",
  deleted: "Excluído",
  notes_updated: "Observações atualizadas",
  client_updated: "Dados atualizados",
  contacts_updated: "Contato atualizado",
  card_draft_saved: "Cartão editado pelo administrador",
  card_published: "Cartão publicado pelo administrador",
  card_draft_discarded: "Alterações descartadas pelo administrador",
  payment_recorded: "Pagamento registrado",
};

/** Complemento do histórico a partir do `detail` gravado pelo banco. */
function detalheDoHistorico(action: string, detail: unknown): string | null {
  const d = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
  if (action === "renewed" && typeof d.months === "number") {
    const novo = typeof d.new_expires_at === "string" ? ` — novo vencimento ${formatarData(d.new_expires_at)}` : "";
    return `${d.months} meses${novo}`;
  }
  if (action === "payment_recorded" && typeof d.months === "number") {
    const partes = [`${d.months} meses`];
    if (typeof d.amount_cents === "number") partes.push(formatarCentavos(d.amount_cents));
    if (typeof d.method === "string") partes.push(rotuloFormaPagamento(d.method));
    return partes.join(" — ");
  }
  if (action === "client_created" && typeof d.package_months === "number") return `pacote de ${d.package_months} meses`;
  if (action === "client_updated" && d.campo === "full_name") return "nome do cliente";
  return null;
}

/** Data de hoje (Belém) no formato do campo de data. */
function hojeIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Belem" });
}

export default async function DetalheClientePage(props: PageProps<"/admin/clientes/[username]">) {
  const actor = await getActor();
  if (!actor.logado) redirect("/login");
  if (!actor.isAdmin) redirect("/painel");

  const { username } = await props.params;
  const cliente = await buscarClientePorUsername(username);
  if (!cliente) notFound();

  const [observacoes, historico, conteudos, pedidos, contatos, pagamentos, footer] = await Promise.all([
    buscarObservacoes(cliente.id),
    historicoDoCliente(cliente.username),
    buscarConteudosDoCartao(cliente.id),
    listarPedidosSuporte({ clientId: cliente.id, limite: 10 }),
    buscarContatos(cliente.id),
    listarPagamentos(cliente.id),
    getCardFooter(),
  ]);
  const urlCartao = urlPublicaDoCartao(cliente.username);
  const saude = avaliarSaudeDoCartao({
    status: cliente.status,
    diasParaVencer: cliente.days_until_expiry,
    estadoCartao: cliente.card_state,
    publicado: conteudos.publicado,
    rascunho: conteudos.rascunho,
  });

  const situacao =
    cliente.status === "active"
      ? cliente.days_until_expiry > 0 ? `vence em ${dias(cliente.days_until_expiry)}` : "vence hoje"
      : cliente.status === "expired"
        ? `vencido há ${dias(Math.abs(cliente.days_until_expiry))}`
        : "cancelado";
  const assinatura = [
    { rotulo: "Situação", valor: situacao },
    { rotulo: "Vencimento", valor: formatarData(cliente.expires_at) },
    { rotulo: "Pacote atual", valor: `${cliente.package_months} meses` },
    { rotulo: "Última renovação", valor: cliente.last_renewed_at ? formatarData(cliente.last_renewed_at) : "—" },
    { rotulo: "Cliente desde", valor: formatarData(cliente.created_at) },
    ...(cliente.cancelled_on ? [{ rotulo: "Cancelado em", valor: formatarData(cliente.cancelled_on) }] : []),
  ];
  const diasParaExcluir = cliente.deletion_eligible_at ? diasAte(cliente.deletion_eligible_at) : null;
  const elegivel = diasParaExcluir !== null && diasParaExcluir <= 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-3">
        <Link href="/admin" className="ui-link-back w-fit">
          <IconArrowLeft />
          Voltar para a lista
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{cliente.full_name}</h1>
          <StatusBadge status={cliente.status} label={NOMES_STATUS[cliente.status] ?? cliente.status} />
          <CardStateBadge estado={cliente.card_state} />
        </div>
        <p className="text-sm text-zinc-600">
          @{cliente.username}
          {contatos.whatsapp ? (
            <>
              {" · "}
              <a href={linkWhatsapp(contatos.whatsapp)} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                {formatarWhatsapp(contatos.whatsapp)}
              </a>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/clientes/${cliente.username}/cartao`} className="ui-btn ui-btn-primary ui-btn-sm">
            <IconEdit />
            Editar cartão
          </Link>
          <a href={urlCartao} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-outline ui-btn-sm">
            <IconExternal />
            Abrir cartão
          </a>
          <CopyButton value={urlCartao} label="Copiar link do cartão" className="ui-btn ui-btn-outline ui-btn-sm" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="titulo-cartao" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 id="titulo-cartao" className="ui-card-title">
            <IconCard />
            Cartão digital
          </h2>
          <dl className="grid gap-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-muted-foreground">Última publicação</dt>
              <dd className="font-medium">{cliente.published_at ? formatarDataHora(cliente.published_at) : "nunca publicou"}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-muted-foreground">Última edição</dt>
              <dd className="font-medium">{cliente.draft_updated_at ? formatarDataHora(cliente.draft_updated_at) : "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Endereço gravado no NFC</dt>
              <dd className="font-medium break-all">
                <a href={urlCartao} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">{urlCartao}</a>
              </dd>
            </div>
          </dl>
          {cliente.card_state === "pending_changes" ? (
            <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
              <IconAlert className="mt-0.5 size-4 shrink-0" />
              Existem alterações ainda não publicadas.
            </p>
          ) : null}
          {cliente.status !== "active" ? (
            <p className="text-sm text-muted-foreground">Cliente fora do ar: o visitante vê só a página neutra.</p>
          ) : null}
          <CardPreviewTabs publicado={conteudos.publicado} rascunho={conteudos.rascunho} footer={footer} />
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="titulo-saude" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
            <h2 id="titulo-saude" className="ui-card-title">
              <IconHealth />
              Saúde do cartão
            </h2>
            <CardHealthPanel nivel={saude.nivel} itens={saude.itens} />
          </section>

          <section aria-labelledby="titulo-assinatura" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
            <h2 id="titulo-assinatura" className="ui-card-title">
              <IconRefresh />
              Assinatura e renovação
            </h2>
            <dl className="grid gap-y-2 text-sm">
              {assinatura.map((item) => (
                <div key={item.rotulo} className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted-foreground">{item.rotulo}</dt>
                  <dd className="font-medium">{item.valor}</dd>
                </div>
              ))}
            </dl>
            <RenewForm clientId={cliente.id} username={cliente.username} hoje={hojeIso()} />
          </section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="titulo-dados" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 id="titulo-dados" className="ui-card-title">
            <IconUser />
            Dados do cliente
          </h2>
          <ClientDataForm
            clientId={cliente.id}
            username={cliente.username}
            nomeAtual={cliente.full_name}
            whatsapp={contatos.whatsapp}
            email={contatos.email}
          />
        </section>

        <section aria-labelledby="titulo-suporte" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-suporte" className="ui-card-title">
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
                      {pedido.categoriaRotulo}
                      {pedido.priority === "alta" ? <span className="text-destructive"> · prioridade alta</span> : null}
                      <span className={pedido.status === "open" ? "text-gold" : "text-muted-foreground"}>
                        {" · "}
                        {pedido.status === "open" ? "aberto" : "resolvido"}
                      </span>
                    </span>
                    <span className="text-muted-foreground">{formatarDataHora(pedido.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-muted-foreground [overflow-wrap:anywhere]">{pedido.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="titulo-pagamentos" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 id="titulo-pagamentos" className="ui-card-title">
            <IconClock />
            Pagamentos registrados
          </h2>
          {pagamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum pagamento registrado. Use “Registrar pagamento” ao renovar.
            </p>
          ) : (
            <ul className="flex flex-col text-sm">
              {pagamentos.map((p) => (
                <li key={p.id} className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-b-0">
                  <div className="flex flex-wrap justify-between gap-x-4">
                    <span className="font-medium">{formatarData(`${p.paid_on}T12:00:00`)}</span>
                    <span>{p.amount_cents !== null ? formatarCentavos(p.amount_cents) : "valor não informado"}</span>
                  </div>
                  <span className="text-muted-foreground">
                    Plano: {p.months} meses · Pagamento: {rotuloFormaPagamento(p.method)}
                  </span>
                  {p.note ? <span className="text-muted-foreground [overflow-wrap:anywhere]">{p.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-observacoes" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <h2 id="titulo-observacoes" className="ui-card-title">
              <IconNote />
              Observações internas
            </h2>
            <p className="ui-hint mt-1">Privadas — nunca visíveis ao cliente ou ao visitante.</p>
          </div>
          <NotesForm clientId={cliente.id} username={cliente.username} observacoesIniciais={observacoes} />
        </section>
      </div>

      <section aria-labelledby="titulo-historico" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
        <h2 id="titulo-historico" className="ui-card-title">
          <IconClock />
          Histórico administrativo
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <ul className="flex flex-col text-sm">
            {historico.map((item, i) => {
              const detalhe = detalheDoHistorico(item.action, item.detail);
              return (
                <li key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-border py-2.5 last:border-b-0">
                  <span className="font-medium">
                    {NOMES_ACAO[item.action] ?? item.action}
                    {detalhe ? <span className="font-normal text-muted-foreground"> — {detalhe}</span> : null}
                  </span>
                  <span className="text-muted-foreground">{formatarDataHora(item.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="titulo-senha" className="ui-card flex flex-col gap-4 p-5 sm:p-6">
          <h2 id="titulo-senha" className="ui-card-title">
            <IconLock />
            Redefinir senha
          </h2>
          <ResetPasswordForm clientId={cliente.id} username={cliente.username} />
        </section>

        {cliente.status !== "cancelled" ? (
          <section id="cancelar" aria-labelledby="titulo-cancelar" className="ui-card flex scroll-mt-6 flex-col gap-4 p-5 sm:p-6">
            <div>
              <h2 id="titulo-cancelar" className="ui-card-title">
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
      </div>

      {/* Regra de exclusão no banco (política de delete): só cancelado há 3 meses. */}
      <section aria-labelledby="titulo-excluir" className="flex flex-col gap-4 rounded-2xl border border-destructive/25 bg-card p-5 sm:p-6">
        <h2 id="titulo-excluir" className="ui-card-title text-destructive">
          <IconTrash className="text-destructive" />
          Excluir cliente
        </h2>
        {cliente.status !== "cancelled" || !cliente.cancelled_on || !cliente.deletion_eligible_at ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Exclusão não permitida: o cliente precisa estar cancelado há pelo menos 3 meses. Isso evita apagar por
              engano um cliente que ainda pode renovar.
            </p>
            <a href="#cancelar" className="ui-btn ui-btn-outline ui-btn-sm w-fit">Ir para Cancelar</a>
          </div>
        ) : (
          <>
            <dl className="grid gap-y-2 text-sm sm:max-w-md">
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-muted-foreground">Cancelado em</dt>
                <dd className="font-medium">{formatarData(cliente.cancelled_on)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-muted-foreground">Elegível para exclusão</dt>
                <dd className="font-medium">{formatarData(cliente.deletion_eligible_at)}</dd>
              </div>
            </dl>
            {elegivel ? (
              <>
                <p className="w-fit rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
                  Elegível para exclusão
                </p>
                <DeleteSection clientId={cliente.id} username={cliente.username} />
              </>
            ) : (
              <p className="text-sm">
                <span className="font-semibold">Exclusão ainda não permitida</span> — faltam {dias(diasParaExcluir ?? 0)}.
              </p>
            )}
          </>
        )}
        <p className="ui-hint">
          A exclusão apaga a conta de acesso, o cartão, as imagens, os pagamentos registrados e as observações. O nome
          de usuário @{cliente.username} fica reservado: o NFC continua levando à página neutra e a URL não vai para
          outro cliente.
        </p>
      </section>
    </main>
  );
}

