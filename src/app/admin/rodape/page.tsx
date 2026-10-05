import { redirect } from "next/navigation";

import { FooterForm } from "@/app/admin/rodape/footer-form";
import { getActor } from "@/lib/auth/session";
import { getCardFooterSettings } from "@/lib/system/card-footer-server";

/**
 * Rodapé exibido no fim de todos os cartões ativos. Só o administrador
 * edita; o cliente vê o rodapé na prévia, mas não tem como alterar.
 */
export default async function AdminRodapePage() {
  const actor = await getActor();
  if (!actor.logado) redirect("/login");
  if (!actor.isAdmin) redirect("/painel");

  const settings = await getCardFooterSettings();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rodapé dos cartões</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aparece no fim de todos os cartões ativos. Os clientes não podem alterar nem remover.
        </p>
      </div>

      {settings ? (
        <FooterForm initial={settings} />
      ) : (
        <p role="alert" className="ui-card p-5 text-sm text-muted-foreground">
          Não foi possível carregar o rodapé. Se acabou de atualizar o sistema, confira se a migration
          <code className="mx-1">20261004130000_card_footer.sql</code>
          foi aplicada no banco.
        </p>
      )}
    </main>
  );
}
