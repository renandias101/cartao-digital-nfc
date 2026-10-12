import { redirect } from "next/navigation";

import { MfaForm } from "@/app/mfa/mfa-form";
import { getActor } from "@/lib/auth/session";

export default async function MfaPage() {
  const actor = await getActor();
  if (!actor.logado) redirect("/login");
  if (actor.isAdmin) redirect("/admin");
  if (!actor.requiresMfa) redirect("/painel");

  return (
    <main className="grid min-h-dvh place-items-center bg-[linear-gradient(135deg,#c9bbb0_0%,#f7f4f0_40%,#fff_70%,#eee2d4_100%)] px-4 py-8">
      <section aria-labelledby="mfa-title" className="ui-card w-full max-w-md p-6 sm:p-8">
        <p className="mb-2 text-sm font-medium text-gold">Cartão de Visita Digital</p>
        <h1 id="mfa-title" className="text-2xl font-semibold">Verificação em duas etapas</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-muted-foreground">
          Confirme o código do aplicativo autenticador para acessar a administração.
        </p>
        <MfaForm />
      </section>
    </main>
  );
}
