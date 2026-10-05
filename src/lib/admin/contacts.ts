/**
 * Regras do contato administrativo do cliente — iguais aos `check` da tabela
 * `client_admin_contacts` (migration 20261004160000).
 */

/** WhatsApp em dígitos, com DDI (Brasil por padrão quando vier com 10 ou 11 dígitos). */
export function normalizarWhatsapp(valor: string): string | null | "invalido" {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return null;
  const comDdi = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  return /^[0-9]{10,15}$/.test(comDdi) ? comDdi : "invalido";
}

export function emailValido(valor: string): boolean {
  return valor.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor);
}

/** Link de conversa no WhatsApp a partir dos dígitos gravados. */
export function linkWhatsapp(digitos: string): string {
  return `https://wa.me/${digitos}`;
}

/** 5596981233398 → +55 (96) 98123-3398 (só para exibir). */
export function formatarWhatsapp(digitos: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${digitos}`;
}
