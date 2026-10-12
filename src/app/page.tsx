import { redirect } from "next/navigation";

/** A entrada principal do sistema é a tela de autenticação. */
export default function Home() {
  redirect("/login");
}
