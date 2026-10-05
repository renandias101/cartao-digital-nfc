import { botoesVisiveis } from "@/lib/card/buttons";
import type { CardContent } from "@/lib/card/types";

/**
 * O "Salvar Contato" grava só nome e telefone na agenda do visitante: nada de
 * profissão, descrição, endereço ou links (decisão do usuário, D70). O nome
 * fica porque um contato sem nome não serve na agenda.
 */
export type ContactCardData = {
  name: string;
  phones: string[];
};

/** Sem nome ou sem telefone não há contato a salvar, e o botão não aparece. */
export function getContactCardData(content: CardContent): ContactCardData | null {
  const name = content.displayName?.trim();
  if (!name) return null;

  const phones: string[] = [];
  // Mesmo número escrito de jeitos diferentes ("(96) 9…" e "+55 96 9…") entra uma vez só.
  const digitos = (phone: string) => phone.replace(/\D/g, "").slice(-11);
  const addPhone = (phone: string | undefined) => {
    const value = phone?.trim();
    if (value && /\d/.test(value) && !phones.some((p) => digitos(p) === digitos(value))) phones.push(value);
  };

  // O número escolhido para o "Salvar Contato" vem primeiro; botões de
  // telefone antigos (tipo aposentado, D69) continuam valendo.
  addPhone(content.contactPhone);
  for (const button of botoesVisiveis(content)) {
    if (button.type === "phone") addPhone(button.number);
  }

  return phones.length ? { name, phones } : null;
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

  for (const phone of contact.phones) lines.push(`TEL;TYPE=CELL:${escapeVCard(phone)}`);
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
