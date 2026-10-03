import type { CardContent } from "@/lib/card/types";
import { getProfessionColor } from "@/lib/card/profession";

/** Mesmo texto e regra de vazio no cartão público e na prévia. */
export function CardProfession({ content, className }: { content: CardContent; className?: string }) {
  const profession = typeof content.profession === "string" ? content.profession.trim() : "";
  if (!profession) return null;
  return (
    <p data-card-profession className={className}
      style={{ color: getProfessionColor(content) }}>
      {profession}
    </p>
  );
}
