import { redirect } from "next/navigation";

import { NewClientForm } from "@/app/admin/clientes/novo/new-client-form";
import { getActor } from "@/lib/auth/session";
import { listarClientesParaDuplicacao } from "@/lib/admin/clients";

export default async function NovoClientePage() {
  const actor = await getActor();
  if (!actor.logado) {
    redirect("/login");
  }
  if (!actor.isAdmin) {
    redirect(actor.requiresMfa ? "/mfa" : "/painel");
  }

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Belem" });
  const clientes = await listarClientesParaDuplicacao();
  return <NewClientForm hoje={hoje} clientes={clientes} />;
}
