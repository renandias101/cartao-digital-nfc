"use client";

import { IconContact } from "@/components/icons";
import styles from "@/components/digital-card.module.css";
import { buildVCard, getVCardFileName, type ContactCardData } from "@/lib/card/vcard";

export function SaveContactButton({ contact }: { contact: ContactCardData }) {
  function downloadContact() {
    const file = new Blob([buildVCard(contact)], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = getVCardFileName(contact.name);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <button type="button" onClick={downloadContact} className={styles.saveContact}>
      <IconContact className={styles.saveContactIcon} />
      <span>Salvar Contato</span>
    </button>
  );
}
