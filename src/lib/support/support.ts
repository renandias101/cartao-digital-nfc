import { contarCaracteres } from "@/lib/constants";

/**
 * Pedido de suporte enviado pelo balão do editor. "error": o cliente conta o
 * que tentava fazer (`message`) e qual erro apareceu (`errorText`). "help":
 * só o que ele quer (`message`).
 */
export type SupportKind = "error" | "help";

export type SupportInput = {
  kind: SupportKind;
  message: string;
  errorText?: string;
};

/** Igual aos `check` da tabela `support_requests`. */
export const LIMITE_SUPORTE = 1000;

/** Envios por cliente por hora (política de insert no banco). */
export const ENVIOS_SUPORTE_POR_HORA = 5;

export function validarSuporte(
  input: SupportInput,
): { valido: true; pedido: SupportInput } | { valido: false; mensagem: string } {
  if (input.kind !== "error" && input.kind !== "help") {
    return { valido: false, mensagem: "Escolha se é um erro ou um pedido de ajuda." };
  }
  const message = input.message.trim();
  if (!message) {
    return {
      valido: false,
      mensagem: input.kind === "error" ? "Conte o que você estava tentando fazer." : "Conte com o que você precisa de ajuda.",
    };
  }
  if (contarCaracteres(message) > LIMITE_SUPORTE) {
    return { valido: false, mensagem: `Use no máximo ${LIMITE_SUPORTE} caracteres em cada campo.` };
  }
  if (input.kind === "help") return { valido: true, pedido: { kind: "help", message } };

  const errorText = (input.errorText ?? "").trim();
  if (!errorText) return { valido: false, mensagem: "Conte qual erro apareceu (pode ser a mensagem que você viu)." };
  if (contarCaracteres(errorText) > LIMITE_SUPORTE) {
    return { valido: false, mensagem: `Use no máximo ${LIMITE_SUPORTE} caracteres em cada campo.` };
  }
  return { valido: true, pedido: { kind: "error", message, errorText } };
}
