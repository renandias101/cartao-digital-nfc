"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import { enviarImagemAction } from "@/app/painel/editor/actions";
import { ImageCropDialog } from "@/app/painel/editor/image-crop-dialog";
import { IconImage, IconTrash, IconUpload, IconUser } from "@/components/icons";
import type { PropositoImagem } from "@/lib/card/images";
import { validateImageFile } from "@/lib/card/image-upload";
import styles from "./editor.module.css";

/**
 * Campo de upload de imagem (PRD §10, §12). Envia direto ao selecionar —
 * sem passo extra de "confirmar arquivo" — e mostra o resultado ou o erro
 * (arquivo inválido, maior que 5MB) assim que o processamento no servidor
 * responde.
 *
 * `variante="cartao"`: bloco com prévia grande (seção Perfil). O padrão,
 * compacto, é o do ícone personalizado no formulário de botão.
 */
/** Proporção e tamanho do recorte de cada imagem do cartão (iguais às recomendações). */
const RECORTE: Partial<Record<PropositoImagem, { aspect: number; width: number }>> = {
  profile: { aspect: 1, width: 800 },
  banner: { aspect: 3 / 2, width: 1200 },
  background: { aspect: 9 / 16, width: 1080 },
};

export function ImageField({
  proposito,
  label,
  valor,
  aoMudar,
  buttonId,
  formato = "quadrado",
  variante = "compacto",
  recomendacao,
  rotuloTrocar = "Trocar imagem",
}: {
  proposito: PropositoImagem;
  label: string;
  valor?: string;
  aoMudar: (url: string | undefined) => void;
  buttonId?: string;
  formato?: "quadrado" | "largo";
  variante?: "compacto" | "cartao";
  recomendacao?: string;
  rotuloTrocar?: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [recorte, setRecorte] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const configRecorte = variante === "cartao" ? RECORTE[proposito] : undefined;

  function selecionarArquivo(arquivo: File) {
    const validationError = validateImageFile(arquivo);
    setErro(validationError);
    if (validationError) return;
    // Foto, banner e fundo passam pelo enquadramento; o ícone vai direto.
    if (configRecorte) setRecorte(arquivo);
    else enviar(arquivo);
  }

  function enviar(arquivo: File) {
    const validationError = validateImageFile(arquivo);
    setErro(validationError);
    if (validationError) return;
    const formData = new FormData();
    formData.set("file", arquivo);
    startTransition(async () => {
      try {
        const resultado = await enviarImagemAction(proposito, formData, buttonId);
        if (!resultado.ok) {
          setErro(resultado.mensagem);
          return;
        }
        aoMudar(resultado.url);
      } catch {
        // Inclui rejeições de transporte antes de a Server Action executar.
        setErro("Não foi possível enviar a imagem. A imagem anterior foi mantida. Tente novamente.");
      }
    });
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      aria-label={label}
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={(e) => {
        const arquivo = e.target.files?.[0];
        if (arquivo) selecionarArquivo(arquivo);
        e.target.value = "";
      }}
    />
  );
  const mensagemErro = erro ? (
    <p role="alert" className={`text-xs text-destructive ${variante === "cartao" ? styles.imageTileError : ""}`}>
      {erro}
    </p>
  ) : null;
  const botaoRemover = valor ? (
    <button
      type="button"
      disabled={pending}
      onClick={() => aoMudar(undefined)}
      className="ui-btn ui-btn-ghost ui-btn-icon"
      aria-label={`Remover ${label.toLowerCase()}`}
      title="Remover"
    >
      <IconTrash />
    </button>
  ) : null;

  if (variante === "cartao") {
    const redondo = formato === "quadrado";
    return (
      <div className={styles.imageTile}>
        <div className={styles.imageTileHead}>
          <span className="ui-label">{label}</span>
          {recomendacao ? <span className="ui-hint block">{recomendacao}</span> : null}
        </div>
        <div className={`${styles.imagePreview} ${redondo ? styles.imagePreviewRound : ""}`} aria-busy={pending}>
          {valor ? (
            <Image
              src={valor}
              alt=""
              width={redondo ? 112 : 320}
              height={112}
              className="size-full object-cover"
            />
          ) : redondo ? (
            <IconUser className="size-7" />
          ) : (
            <IconImage className="size-6" />
          )}
        </div>
        <div className={styles.imageTileActions}>
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={() => inputRef.current?.click()}
            className="ui-btn ui-btn-outline ui-btn-sm min-w-0 flex-1"
          >
            <IconUpload />
            <span className="truncate">{pending ? "Enviando…" : valor ? rotuloTrocar : "Enviar imagem"}</span>
          </button>
          {botaoRemover}
        </div>
        {input}
        {mensagemErro}
        {recorte && configRecorte ? (
          <ImageCropDialog
            file={recorte}
            title={`Ajustar ${label.toLowerCase()}`}
            aspect={configRecorte.aspect}
            round={proposito === "profile"}
            outputWidth={configRecorte.width}
            onCancel={() => setRecorte(null)}
            onConfirm={(recortado) => {
              setRecorte(null);
              enviar(recortado);
            }}
            onUnreadable={() => {
              // O navegador não abriu a imagem: envia o original e o servidor decide.
              setRecorte(null);
              enviar(recorte);
            }}
          />
        ) : null}
      </div>
    );
  }

  const tamanhoMiniatura = formato === "quadrado" ? "size-16" : "h-16 w-28";

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="ui-label">{label}</span>
      {valor ? (
        <Image
          src={valor}
          alt=""
          width={formato === "quadrado" ? 64 : 112}
          height={64}
          className={`${tamanhoMiniatura} rounded-xl border border-border object-cover`}
        />
      ) : (
        <div
          aria-hidden="true"
          className={`${tamanhoMiniatura} grid place-items-center rounded-xl border border-dashed border-input bg-muted text-muted-foreground`}
        >
          <IconImage className="size-5" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() => inputRef.current?.click()}
          className="ui-btn ui-btn-outline ui-btn-sm"
        >
          {pending ? "Enviando…" : valor ? "Trocar imagem" : "Enviar imagem"}
        </button>
        {botaoRemover}
      </div>
      {input}
      {mensagemErro}
    </div>
  );
}
