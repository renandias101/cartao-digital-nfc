import { redirect } from "next/navigation";

/** O editor agora fica na página única do cliente; mantém links antigos funcionando. */
export default function EditorPage() {
  redirect("/painel#editor");
}
