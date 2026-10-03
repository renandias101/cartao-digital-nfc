import type { CardContent } from "@/lib/card/types";

/** Cor explícita afeta só a profissão; o padrão contrasta com o fundo sólido. */
export function getProfessionColor(content: CardContent): string {
  if (content.professionColor && /^#([\da-f]{3}|[\da-f]{6})$/i.test(content.professionColor)) {
    return content.professionColor;
  }
  return getContrastingColor(content.backgroundColor ?? "#ffffff");
}

/** Contraste derivado da cor do cliente, sem adotar uma paleta da referência. */
export function getContrastingColor(background: string): string {
  let hex = background.replace("#", "");
  if (hex.length === 3) hex = Array.from(hex, (digit) => digit + digit).join("");
  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
