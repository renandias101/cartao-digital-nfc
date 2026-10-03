import { redirect } from "next/navigation";

import { NewClientForm } from "@/app/admin/clientes/novo/new-client-form";
import { getActor } from "@/lib/auth/session";

export default async function NovoClientePage() {
  const actor = await getActor();
  if (!actor.logado) {
    redirect("/login");
  }
  if (!actor.isAdmin) {
    redirect("/painel");
  }

  return <NewClientForm />;
}
