import Image from "next/image";
import type { CSSProperties } from "react";
import { ButtonView, FeaturedLink } from "@/app/[username]/button-view";
import { CardProfession } from "@/components/card-profession";
import { SaveContactButton } from "@/components/save-contact-button";
import { botoesVisiveis } from "@/lib/card/buttons";
import { getCardInitials, organizeCardButtons } from "@/lib/card/presentation";
import { getContrastingColor } from "@/lib/card/profession";
import type { CardContent } from "@/lib/card/types";
import { getContactCardData } from "@/lib/card/vcard";
import styles from "./digital-card.module.css";

/** Única composição para a versão publicada e a prévia do rascunho. */
export function DigitalCard({ content, preview = false }: { content: CardContent; preview?: boolean }) {
  const background = content.backgroundColor ?? "#ffffff";
  const surface = content.buttonColor ?? "#1c1c1c";
  const foreground = getContrastingColor(background);
  const surfaceForeground = getContrastingColor(surface);
  // No tema escuro, o dourado distingue a ação principal das superfícies.
  // A cor da profissão continua independente das demais escolhas visuais.
  const accent = foreground === "#ffffff" && surfaceForeground === "#ffffff"
    ? "#ffbf52"
    : surface;
  const Heading = preview ? "h2" : "h1";
  const buttons = botoesVisiveis(content);
  const { featured, regular } = organizeCardButtons(buttons);
  const contact = getContactCardData(content);
  const style = {
    "--card-accent": accent,
    "--card-accent-foreground": getContrastingColor(accent),
    "--card-background": background,
    "--card-foreground": foreground,
    "--card-surface": surface,
    "--card-surface-foreground": surfaceForeground,
    "--card-icon": surfaceForeground === "#ffffff" && foreground === "#ffffff" ? accent : surfaceForeground,
    backgroundColor: background,
    backgroundImage: content.backgroundImage ? `url(${content.backgroundImage})` : undefined,
    color: foreground,
  } as CSSProperties;

  return (
    <article className={styles.card} style={style} data-digital-card>
      <div className={styles.cover} aria-hidden="true">
        {content.banner ? <Image src={content.banner} alt="" fill sizes="(max-width: 420px) 100vw, 420px" className={styles.coverImage} />
          : <div className={styles.decoration} />}
      </div>
      <header className={styles.profile}>
        {content.profilePhoto ? <Image src={content.profilePhoto} alt="" width={200} height={200}
          sizes="(max-width: 420px) 48vw, 200px" className={styles.avatar} loading="eager" />
          : <div className={`${styles.avatar} ${styles.avatarFallback}`} aria-hidden="true">
              {getCardInitials(content.displayName)}
            </div>}
        <Heading className={styles.name}>{content.displayName || (preview ? "Nome do cartão" : "")}</Heading>
        <CardProfession content={content} className={styles.profession} />
        {content.description ? <p className={styles.description}>{content.description}</p> : null}
      </header>
      {featured.length ? (
        <nav className={styles.featuredLinks} aria-label="Contato e redes sociais">
          {featured.map(({ button, kind }) => <FeaturedLink key={button.id} button={button} kind={kind} />)}
        </nav>
      ) : null}
      {contact ? <div className={styles.saveContactWrap}><SaveContactButton contact={contact} /></div> : null}
      {regular.length ? <div className={styles.links}>
        {regular.map(button => <ButtonView key={button.id} button={button} />)}
      </div> : null}
    </article>
  );
}
