import Image from "next/image";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { IconChevronDown, IconLink } from "@/components/icons";
import { SYSTEM_ICON_COMPONENTS } from "@/components/system-icons";
import {
  isSystemIconKey,
  isUploadedIcon,
  resolveButtonIcon,
  type FeaturedLinkKind,
  type SystemIconKey,
} from "@/lib/card/presentation";
import type { CardButton, LinkButton } from "@/lib/card/types";
import styles from "@/components/digital-card.module.css";

const labels = { link: "Link", text: "Informações", wifi: "Wi-Fi", pix: "PIX", phone: "Telefone", address: "Endereço" };

/** Ícone enviado > ícone escolhido > `fallback` (deduzido pelo tipo e título). */
export function ButtonIcon({ button, className, fallback = resolveButtonIcon(button) }: {
  button: CardButton;
  className?: string;
  fallback?: SystemIconKey;
}) {
  if (isUploadedIcon(button.icon)) {
    return <Image src={button.icon} alt="" width={32} height={32} className={className} />;
  }
  // Chave desconhecida (ex.: salva por uma versão futura) cai no ícone automático, e este no de link.
  const Icon = SYSTEM_ICON_COMPONENTS[isSystemIconKey(button.icon) ? button.icon : fallback] ?? IconLink;
  return <Icon className={className} />;
}

export function FeaturedLink({ button, kind }: { button: LinkButton; kind: FeaturedLinkKind | null }) {
  return (
    <a
      href={button.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.featuredLink}
      data-button-id={button.id}
      aria-label={`Abrir ${button.title}`}
    >
      <span className={styles.featuredIconBox}>
        <ButtonIcon button={button} fallback={kind ?? undefined} className={styles.featuredIcon} />
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
    return <a href={button.url} target="_blank" rel="noopener noreferrer" className={styles.action} data-button-id={button.id}>{heading}</a>;
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
  return <details className={styles.details} data-button-id={button.id}>
    <summary className={styles.action}>{heading}</summary>
    <div className={styles.detailsContent}>{details}</div>
  </details>;
}
