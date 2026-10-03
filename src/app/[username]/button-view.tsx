import Image from "next/image";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import {
  IconCard,
  IconChevronDown,
  IconInstagram,
  IconLinkedIn,
  IconLink,
  IconLock,
  IconMail,
  IconMapPin,
  IconMonitor,
  IconNote,
  IconPhone,
  IconWhatsApp,
} from "@/components/icons";
import type { FeaturedLinkKind } from "@/lib/card/presentation";
import type { CardButton, LinkButton } from "@/lib/card/types";
import styles from "@/components/digital-card.module.css";

const labels = { link: "Link", text: "Informações", wifi: "Wi-Fi", pix: "PIX", phone: "Telefone", address: "Endereço" };

function ButtonIcon({ button, className }: { button: CardButton; className?: string }) {
  if (button.icon?.startsWith("https://") || button.icon?.startsWith("/")) {
    return <Image src={button.icon} alt="" width={32} height={32} className={className} />;
  }
  const title = button.title?.toLocaleLowerCase("pt-BR") ?? "";
  if (button.type === "link" && /serviç/.test(title)) return <IconMonitor className={className} />;
  if (/localiza|endereç/.test(title)) return <IconMapPin className={className} />;
  switch (button.type) {
    case "link": return <IconLink className={className} />;
    case "text": return <IconNote className={className} />;
    case "wifi": return <IconLock className={className} />;
    case "pix": return <IconCard className={className} />;
    case "phone": return <IconPhone className={className} />;
    case "address": return <IconMapPin className={className} />;
  }
}

function FeaturedIcon({ kind, className }: { kind: FeaturedLinkKind; className?: string }) {
  switch (kind) {
    case "whatsapp": return <IconWhatsApp className={className} />;
    case "instagram": return <IconInstagram className={className} />;
    case "linkedin": return <IconLinkedIn className={className} />;
    case "email": return <IconMail className={className} />;
  }
}

export function FeaturedLink({ button, kind }: { button: LinkButton; kind: FeaturedLinkKind }) {
  return (
    <a
      href={button.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.featuredLink}
      aria-label={`Abrir ${button.title}`}
    >
      <span className={styles.featuredIconBox}>
        {button.icon?.startsWith("https://") || button.icon?.startsWith("/")
          ? <Image src={button.icon} alt="" width={36} height={36} className={styles.featuredIcon} />
          : <FeaturedIcon kind={kind} className={styles.featuredIcon} />}
      </span>
      <span className={styles.featuredLabel}>{button.title}</span>
    </a>
  );
}

/** Mantém os seis tipos e as ações existentes, compartilhados com a prévia. */
export function ButtonView({ button }: { button: CardButton }) {
  const description = "description" in button ? button.description : undefined;
  const heading = <>
    <ButtonIcon button={button} className={styles.icon} />
    <span className={styles.actionText}>
      <span className={styles.actionTitle}>{button.title || labels[button.type]}</span>
      {button.type === "link" && description ? <span className={styles.actionDescription}>{description}</span> : null}
    </span>
    <IconChevronDown className={styles.arrow} />
  </>;

  if (button.type === "link") {
    return <a href={button.url} target="_blank" rel="noopener noreferrer" className={styles.action}>{heading}</a>;
  }

  let details: ReactNode;
  switch (button.type) {
    case "text":
      details = <>{button.description ? <p>{button.description}</p> : null}<p>{button.content}</p></>;
      break;
    case "wifi":
      details = <><p>Rede: {button.ssid}</p><p>Senha: {button.password}</p><CopyButton value={button.password} label="Copiar senha" /></>;
      break;
    case "pix":
      details = <><p>{button.key}</p><CopyButton value={button.key} label="Copiar chave" /></>;
      break;
    case "phone":
      details = <><p>{button.number}</p><CopyButton value={button.number} label="Copiar número" /></>;
      break;
    case "address":
      details = <>
        <p>{button.address}</p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(button.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.detailsAction}
        >
          Abrir no mapa
        </a>
      </>;
      break;
  }
  return <details className={styles.details}>
    <summary className={styles.action}>{heading}</summary>
    <div className={styles.detailsContent}>{details}</div>
  </details>;
}
