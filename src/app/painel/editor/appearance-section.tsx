"use client";

import { EditorSection } from "@/app/painel/editor/editor-section";
import { IconPalette } from "@/components/icons";
import { getAccentColor } from "@/lib/card/presentation";
import { getProfessionColor } from "@/lib/card/profession";
import type { CardContent } from "@/lib/card/types";
import styles from "./editor.module.css";

/** As quatro cores do cartão. A prévia reage na hora, sem salvar. */
export function AppearanceSection({
  content,
  onChange,
}: {
  content: CardContent;
  onChange: (fields: Partial<CardContent>) => void;
}) {
  return (
    <EditorSection
      icon={<IconPalette />}
      title="Aparência"
      description="Personalize as cores e o estilo do seu cartão."
    >
      <div className={styles.colorsGrid}>
        <ColorField
          id="backgroundColor"
          label="Cor do fundo"
          value={content.backgroundColor ?? "#ffffff"}
          onChange={(cor) => onChange({ backgroundColor: cor })}
        />
        <ColorField
          id="buttonColor"
          label="Cor dos botões"
          value={content.buttonColor ?? "#000000"}
          onChange={(cor) => onChange({ buttonColor: cor })}
        />
        <ColorField
          id="professionColor"
          label="Cor do texto de profissão/nicho"
          value={getProfessionColor(content)}
          onChange={(cor) => onChange({ professionColor: cor })}
        />
        <ColorField
          id="accentColor"
          label="Cor de destaque"
          hint="Salvar Contato e ícones"
          value={getAccentColor(content)}
          onChange={(cor) => onChange({ accentColor: cor })}
        />
      </div>
    </EditorSection>
  );
}

/** Seletor de cor com amostra e o código hexadecimal visível ao lado. */
function ColorField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (cor: string) => void;
}) {
  return (
    <div className={styles.colorTile}>
      <label htmlFor={id} className="ui-label">
        {label}
        {hint ? <span className="block text-xs font-normal text-muted-foreground">({hint})</span> : null}
      </label>
      <div className={styles.colorControl}>
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="ui-color" />
        <span className="font-mono text-sm uppercase" aria-hidden="true">
          {value}
        </span>
      </div>
    </div>
  );
}
