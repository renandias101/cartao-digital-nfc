import { redirect } from "next/navigation";

import { logoutAction } from "@/app/painel/actions";
import { ChangePasswordForm } from "@/app/painel/change-password-form";
import { CardEditor } from "@/app/painel/editor/card-editor";
import editorStyles from "@/app/painel/editor/editor.module.css";
import { EditorHeader } from "@/app/painel/editor-header";
import { IconAlert, IconClock, IconLogout } from "@/components/icons";
import { buscarPainelDoCliente } from "@/lib/card/dashboard";
import { getDraft } from "@/lib/card/draft";
import { getActor } from "@/lib/auth/session";
import { publicEnv, urlPublicaDoCartao } from "@/lib/env";

function linkWhatsapp(): string {
  const mensagem = encodeURIComponent("Olá, gostaria de renovar meu cartão digital.");
  return `https://wa.me/${publicEnv.whatsappRenovacao}?text=${mensagem}`;
}

/**
 * Área do cliente em uma única página (PRD §14, §15, §20-§22, §25, §32):
 * situação e link do cartão no topo, editor com prévia e troca de senha.
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
      <EditorHeader
        status={painel.status}
        expiresAt={new Date(painel.expiresAt).toLocaleDateString("pt-BR")}
        publicUrl={url}
        publicPath={`/${painel.username}`}
        accountAction={
          <form action={logoutAction}>
            <button type="submit" className="ui-btn ui-btn-danger ui-btn-sm">
              <IconLogout />
              Sair
            </button>
          </form>
        }
      />

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

      <section id="editor" aria-label="Edição do cartão" className={editorStyles.band}>
        {content ? (
          <CardEditor
            initialContent={content}
            isActive={ativo}
            hasUnpublishedChanges={painel.temAlteracoesNaoPublicadas}
            passwordForm={<ChangePasswordForm />}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="ui-card p-5 text-sm text-muted-foreground">
              Não foi possível carregar seu cartão. Tente novamente.
            </p>
            <div className="ui-card p-5 sm:p-6">
              <ChangePasswordForm />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
