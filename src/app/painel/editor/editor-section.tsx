import { useId, type ReactNode } from "react";

import styles from "./editor.module.css";

/** Bloco do editor: ícone, título, descrição curta e ação opcional à direita. */
export function EditorSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.sectionHeading}>
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className={styles.sectionAction}>{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
