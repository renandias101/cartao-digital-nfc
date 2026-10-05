import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  enviarImagemAdminAction,
  publicarAdminAction,
  restaurarAdminAction,
  salvarRascunhoAdminAction,
} from "@/app/admin/clientes/[username]/cartao/actions";
import { CardStateBadge } from "@/app/admin/card-state-badge";
import { CardEditor } from "@/app/painel/editor/card-editor";
import editorStyles from "@/app/painel/editor/editor.module.css";
import { IconAlert, IconArrowLeft, IconExternal } from "@/components/icons";
import { buscarClientePorUsername, buscarConteudosDoCartao } from "@/lib/admin/clients";
import { getActor } from "@/lib/auth/session";
import { urlPublicaDoCartao } from "@/lib/env";
import { getCardFooter } from "@/lib/system/card-footer-server";

/**
 * O administrador edita o cartão de um cliente com o MESMO editor do cliente
 * (`CardEditor`) — sem entrar como ele. Só as ações mudam: cada uma chega
 * presa ao cliente alvo e é autorizada no servidor (sessão de admin) e no
 * banco (`admin_*`), que também registram a auditoria.
 */
export default async function EditarCartaoDoClientePage(props: PageProps<"/admin/clientes/[username]/cartao">) {
  const actor = await getActor();
  if (!actor.logado) redirect("/login");
  if (!actor.isAdmin) redirect("/painel");

  const { username } = await props.params;
  const cliente = await buscarClientePorUsername(username);
  if (!cliente) notFound();

  const [{ rascunho }, footer] = await Promise.all([buscarConteudosDoCartao(cliente.id), getCardFooter()]);

  return (
    <main className={editorStyles.page}>
      <header className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 pb-4">
        <Link href={`/admin/clientes/${cliente.username}`} className="ui-link-back w-fit">
          <IconArrowLeft />
          Voltar para a ficha do cliente
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">Cartão de {cliente.full_name}</h1>
          <CardStateBadge estado={cliente.card_state} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600">
          <span>@{cliente.username}</span>
          <a href={urlPublicaDoCartao(cliente.username)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary hover:underline">
            <IconExternal className="size-4" />
            Abrir cartão publicado
          </a>
        </div>
        <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-accent-soft/50 px-4 py-3 text-sm">
          <IconAlert className="mt-0.5 size-4 shrink-0 text-gold" />
          <span>
            Você está editando como administrador. As alterações vão para o rascunho do cliente e só entram no ar ao
            publicar. Edições, publicação e descarte ficam no histórico do cliente. Se o cliente estiver editando ao
            mesmo tempo, vale a última alteração salva.
            {cliente.status !== "active" ? " O cliente não está ativo: mesmo publicado, o visitante continua vendo a página neutra." : ""}
          </span>
        </p>
      </header>

      <section aria-label="Edição do cartão" className={editorStyles.band}>
        {rascunho ? (
          <CardEditor
            initialContent={rascunho}
            isActive
            hasUnpublishedChanges={cliente.card_state !== "up_to_date"}
            footer={footer}
            actions={{
              salvarRascunho: salvarRascunhoAdminAction.bind(null, cliente.id),
              publicar: publicarAdminAction.bind(null, cliente.id),
              restaurar: restaurarAdminAction.bind(null, cliente.id),
              enviarImagem: enviarImagemAdminAction.bind(null, cliente.id),
            }}
          />
        ) : (
          <p className="ui-card p-5 text-sm text-muted-foreground">Rascunho do cliente não encontrado.</p>
        )}
      </section>
    </main>
  );
}
