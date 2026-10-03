import Link from "next/link";
import { redirect } from "next/navigation";

import { CardEditor } from "@/app/painel/editor/card-editor";
import { IconArrowLeft, IconExternal } from "@/components/icons";
import { getDraft } from "@/lib/card/draft";
import { getActor } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./editor.module.css";

/** Editor do cartão (PRD §14, §15). */
export default async function EditorPage() {
  const actor = await getActor();
  if (!actor.logado) {
    redirect("/login");
  }
  if (actor.isAdmin) {
    redirect("/admin");
  }

  const [content, statusRow] = await Promise.all([
    getDraft(),
    (async () => {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("clients_with_status")
        .select("status, username")
        .eq("id", actor.userId)
        .maybeSingle();
      return data;
    })(),
  ]);

  if (!content) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link href="/painel" className="ui-link-back w-fit">
          <IconArrowLeft />
          Voltar para o painel
        </Link>
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar seu cartão. Tente novamente.
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <nav className={styles.topbar} aria-label="Navegação do editor">
        <Link href="/painel" className="ui-link-back w-fit">
          <IconArrowLeft />
          Voltar para o painel
        </Link>
        {statusRow?.username ? (
          <a href={`/${statusRow.username}`} target="_blank" rel="noopener noreferrer"
            className="ui-btn ui-btn-outline">
            Ver meu cartão
            <IconExternal />
          </a>
        ) : null}
      </nav>
      <section className={styles.workspace} aria-labelledby="editor-title">
        <header className={styles.heading}>
          <h1 id="editor-title">Editor do cartão</h1>
          <p>
            Personalize as informações e veja o resultado em tempo real.
          </p>
        </header>
        <CardEditor initialContent={content} isActive={statusRow?.status === "active"} />
      </section>
    </main>
  );
}
