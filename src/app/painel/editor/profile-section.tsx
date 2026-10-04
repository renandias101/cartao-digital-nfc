"use client";

import type { ReactNode } from "react";

import { EditorSection } from "@/app/painel/editor/editor-section";
import { ImageField } from "@/app/painel/editor/image-field";
import { IconUser } from "@/components/icons";
import type { CardContent } from "@/lib/card/types";
import { LIMITES_TEXTO } from "@/lib/constants";
import styles from "./editor.module.css";

/** Imagens e textos do topo do cartão; a troca de senha entra no fim, como subseção. */
export function ProfileSection({
  content,
  onChange,
  passwordForm,
}: {
  content: CardContent;
  onChange: (fields: Partial<CardContent>) => void;
  passwordForm?: ReactNode;
}) {
  const descricao = content.description ?? "";
  return (
    <EditorSection
      icon={<IconUser />}
      title="Perfil"
      description="Estas informações aparecem no topo do seu cartão."
    >
      <div className={styles.imageFields}>
        <ImageField
          variante="cartao"
          proposito="profile"
          label="Foto de perfil"
          recomendacao="Recomendado: 400×400 px"
          rotuloTrocar="Trocar foto"
          valor={content.profilePhoto}
          aoMudar={(url) => onChange({ profilePhoto: url })}
        />
        <ImageField
          variante="cartao"
          proposito="banner"
          label="Banner"
          formato="largo"
          recomendacao="Recomendado: 1200×800 px"
          rotuloTrocar="Trocar banner"
          valor={content.banner}
          aoMudar={(url) => onChange({ banner: url })}
        />
        <ImageField
          variante="cartao"
          proposito="background"
          label="Imagem de fundo"
          formato="largo"
          recomendacao="Recomendado: 1080×1920 px"
          rotuloTrocar="Trocar imagem de fundo"
          valor={content.backgroundImage}
          aoMudar={(url) => onChange({ backgroundImage: url })}
        />
      </div>

      <div className={styles.fieldPair}>
        <div className="space-y-1.5">
          <label htmlFor="displayName" className="ui-label">
            Nome
          </label>
          <input
            id="displayName"
            type="text"
            value={content.displayName ?? ""}
            maxLength={LIMITES_TEXTO.nomeExibido}
            onChange={(e) => onChange({ displayName: e.target.value })}
            className="ui-input"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="profession" className="ui-label">
            Profissão / nicho
          </label>
          <input
            id="profession"
            name="profession"
            type="text"
            value={content.profession ?? ""}
            maxLength={LIMITES_TEXTO.profession}
            placeholder="Ex.: Desenvolvedor Web"
            aria-describedby="profession-hint"
            onChange={(e) => onChange({ profession: e.target.value })}
            className="ui-input"
          />
          <p id="profession-hint" className="ui-hint">
            Opcional. Até {LIMITES_TEXTO.profession} caracteres.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="ui-label">
          Descrição
        </label>
        <div className="relative">
          <textarea
            id="description"
            value={descricao}
            maxLength={LIMITES_TEXTO.descricaoPrincipal}
            rows={3}
            aria-describedby="description-count"
            onChange={(e) => onChange({ description: e.target.value })}
            className="ui-input pb-7"
          />
          <span
            id="description-count"
            className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground tabular-nums"
          >
            {descricao.length}/{LIMITES_TEXTO.descricaoPrincipal}
            <span className="sr-only"> caracteres usados</span>
          </span>
        </div>
      </div>

      {passwordForm ? <div className={styles.subsection}>{passwordForm}</div> : null}
    </EditorSection>
  );
}
