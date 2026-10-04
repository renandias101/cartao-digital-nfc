import { redirect } from "next/navigation";

import { logoutAction } from "@/app/painel/actions";
import { ChangePasswordForm } from "@/app/painel/change-password-form";
import { CardEditor } from "@/app/painel/editor/card-editor";
import editorStyles from "@/app/painel/editor/editor.module.css";
import { CopyButton } from "@/components/copy-button";
import { IconAlert, IconClock, IconExternal, IconLink, IconLogout } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { buscarPainelDoCliente } from "@/lib/card/dashboard";
import { getDraft } from "@/lib/card/draft";
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
 * Área do cliente em uma única página (PRD §14, §15, §20-§22, §25, §32):
 * link e situação do cartão, editor com prévia e troca de senha.
 *
 * O `proxy.ts` já redireciona quem não está logado antes de chegar aqui
 * (conveniência de navegação, D19); esta página confere de novo — é ela a
 * autoridade de verdade sobre quem pode vê-la (D7).
 */
export default async function PainelPage() {
  const actor = await getActor();
  if (!actor.logado) {
    redirect("/login");
  }
  if (actor.isAdmin) {
    redirect("/admin");
  }

  const [painel, content] = await Promise.all([buscarPainelDoCliente(), getDraft()]);
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
    <main className={editorStyles.page}>
      <header className={editorStyles.topbar}>
        <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
          Olá, {painel.fullName}
        </h1>
        <div className="flex flex-wrap gap-2">
          <a href={`/${painel.username}`} target="_blank" rel="noopener noreferrer"
            className="ui-btn ui-btn-outline">
            <IconExternal />
            Ver meu cartão
          </a>
          <form action={logoutAction}>
            <button type="submit" className="ui-btn ui-btn-outline">
              <IconLogout />
              Sair
            </button>
          </form>
        </div>
      </header>

      {!ativo ? (
        <section className={`${editorStyles.band} flex flex-col gap-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-5 text-sm sm:flex-row sm:items-center sm:justify-between`}>
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
        <section className={`${editorStyles.band} flex flex-col gap-4 rounded-2xl border border-warning/20 bg-warning-soft p-5 text-sm sm:flex-row sm:items-center sm:justify-between`}>
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

      <div className={`${editorStyles.band} grid gap-3 lg:grid-cols-3`}>
        <section className="ui-card flex min-w-0 flex-col gap-3 p-5 lg:col-span-2">
          <h2 className="ui-card-title">
            <IconLink />
            Seu cartão
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 break-all rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm font-medium">
              {url}
            </p>
            <CopyButton value={url} label="Copiar link" className="ui-btn ui-btn-outline shrink-0" />
          </div>
          {painel.temAlteracoesNaoPublicadas ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-gold" />
              Você tem alterações no rascunho ainda não publicadas.
            </p>
          ) : null}
        </section>

        <section className="ui-card flex min-w-0 flex-col gap-3 p-5">
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
      </div>

      <section id="editor" className={editorStyles.workspace} aria-labelledby="editor-title">
        <header className={editorStyles.heading}>
          <h2 id="editor-title">Editor do cartão</h2>
          <p>
            Personalize as informações e veja o resultado em tempo real.
          </p>
        </header>
        {content ? (
          <CardEditor initialContent={content} isActive={ativo} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar seu cartão. Tente novamente.
          </p>
        )}
      </section>

      <section className={`${editorStyles.band} ui-card min-w-0 p-5 sm:p-6`}>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
