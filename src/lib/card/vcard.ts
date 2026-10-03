import { botoesVisiveis } from "@/lib/card/buttons";
import type { CardContent } from "@/lib/card/types";

export type ContactCardData = {
  name: string;
  profession?: string;
  description?: string;
  phones: string[];
  addresses: string[];
  urls: string[];
};

export function getContactCardData(content: CardContent): ContactCardData | null {
  const name = content.displayName?.trim();
  if (!name) return null;

  const phones: string[] = [];
  const addresses: string[] = [];
  const urls: string[] = [];

  for (const button of botoesVisiveis(content)) {
    if (button.type === "phone") phones.push(button.number);
    if (button.type === "address") addresses.push(button.address);
    if (button.type === "link") urls.push(button.url);
  }

  return {
    name,
    profession: content.profession?.trim() || undefined,
    description: content.description?.trim() || undefined,
    phones,
    addresses,
    urls,
  };
}

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** vCard 3.0 é amplamente aceito pelos contatos do iOS, Android e desktop. */
export function buildVCard(contact: ContactCardData): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(contact.name)}`,
    `N:;${escapeVCard(contact.name)};;;`,
  ];

  if (contact.profession) lines.push(`TITLE:${escapeVCard(contact.profession)}`);
  if (contact.description) lines.push(`NOTE:${escapeVCard(contact.description)}`);
  for (const phone of contact.phones) lines.push(`TEL;TYPE=CELL:${escapeVCard(phone)}`);
  for (const address of contact.addresses) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(address)};;;;`);
  for (const url of contact.urls) lines.push(`URL:${escapeVCard(url)}`);
  lines.push("END:VCARD");

  return `${lines.join("\r\n")}\r\n`;
}

export function getVCardFileName(name: string): string {
  const safeName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safeName || "contato"}.vcf`;
}
