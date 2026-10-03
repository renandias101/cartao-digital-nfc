import Link from "next/link";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/app/painel/change-password-form";
import { CopyButton } from "@/components/copy-button";
import { IconAlert, IconClock, IconEdit, IconExternal, IconLink } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { buscarPainelDoCliente } from "@/lib/card/dashboard";
import { getActor } from "@/lib/auth/session";
import { publicEnv, urlPublicaDoCartao } from "@/lib/env";

const NOMES_STATUS: Record<string, string> = {
  active: "Ativo",
  expired: "Vencido",
  cancelled: "Cancelado",
};

function linkWhatsapp(): string {
  const mensagem = encodeURIComponent("Olá, gostaria de renovar meu cartão digital.");
  return `https://wa.me/${publicEnv.whatsappRenovacao}?text=${mensagem}`;
}

/**
 * Painel do cliente (PRD §20-§22, §25, §32).
 *
 * O `proxy.ts` já redireciona quem não está logado antes de chegar aqui
 * (conveniência de navegação, D19); esta página confere de novo — é ela a
 * autoridade de verdade sobre quem pode vê-la (D7). O botão "Sair" fica na
 * sidebar (`painel/layout.tsx`).
 */
export default async function PainelPage() {
  const actor = await getActor();
  if (!actor.logado) {
    redirect("/login");
  }
  if (actor.isAdmin) {
    redirect("/admin");
  }

  const painel = await buscarPainelDoCliente();
  if (!painel) {
    // Sessão válida mas sem linha em `clients` — não deveria acontecer no
    // fluxo normal (só admin não tem linha em clients, e já foi tratado
    // acima). Mensagem genérica em vez de tela quebrada.
    return (
      <main className="flex min-h-[60dvh] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar seus dados. Tente novamente.
        </p>
      </main>
    );
  }

  const url = urlPublicaDoCartao(painel.username);
  const ativo = painel.status === "active";
  const venceLogo = ativo && painel.daysUntilExpiry <= 15;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header>
        <h1 className="break-words text-2xl font-semibold tracking-tight">
          Olá, {painel.fullName}
        </h1>
      </header>

      {!ativo ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <IconAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="leading-relaxed">
              Seu cartão está indisponível para o público no momento. Renove para
              reativar — a edição e a publicação também ficam disponíveis de novo
              assim que o cartão voltar a ficar ativo.
            </p>
          </div>
          <a
            href={linkWhatsapp()}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn ui-btn-primary shrink-0"
          >
            Renovar pelo WhatsApp
          </a>
        </section>
      ) : venceLogo ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-warning/20 bg-warning-soft p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <IconClock className="size-5 shrink-0 text-warning" />
            <p className="font-medium text-warning">
              Seu cartão vence em {painel.daysUntilExpiry} dia
              {painel.daysUntilExpiry === 1 ? "" : "s"}.
            </p>
          </div>
          <a
            href={linkWhatsapp()}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn ui-btn-outline shrink-0"
          >
            Renovar pelo WhatsApp
          </a>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="ui-card flex min-w-0 flex-col gap-4 p-5 sm:p-6 lg:col-span-2">
          <h2 className="ui-card-title">
            <IconLink />
            Seu cartão
          </h2>
          <p className="break-all rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm font-medium">
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/painel/editor" className="ui-btn ui-btn-primary">
              <IconEdit />
              Editar cartão
            </Link>
            <CopyButton value={url} label="Copiar link" className="ui-btn ui-btn-outline" />
            <a
              href={`/${painel.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-btn ui-btn-outline"
            >
              <IconExternal />
              Visualizar cartão
            </a>
          </div>
          {painel.temAlteracoesNaoPublicadas ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-gold" />
              Você tem alterações no rascunho ainda não publicadas.
            </p>
          ) : null}
        </section>

        <section className="ui-card flex min-w-0 flex-col gap-4 p-5 sm:p-6">
          <h2 className="ui-card-title">
            <IconClock />
            Situação do cartão
          </h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge
                  status={painel.status}
                  label={NOMES_STATUS[painel.status] ?? painel.status}
                />
              </dd>
            </div>
            {ativo ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Vencimento</dt>
                <dd className="font-medium">
                  {new Date(painel.expiresAt).toLocaleDateString("pt-BR")}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="ui-card min-w-0 p-5 sm:p-6 lg:col-span-3">
          <ChangePasswordForm />
        </section>
      </div>
    </main>
  );
}
