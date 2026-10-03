"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import { enviarImagemAction } from "@/app/painel/editor/actions";
import { IconImage, IconTrash } from "@/components/icons";
import type { PropositoImagem } from "@/lib/card/images";
import { validateImageFile } from "@/lib/card/image-upload";

/**
 * Campo de upload de imagem (PRD §10, §12). Envia direto ao selecionar —
 * sem passo extra de "confirmar arquivo" — e mostra o resultado ou o erro
 * (arquivo inválido, maior que 5MB) assim que o processamento no servidor
 * responde.
 */
export function ImageField({
  proposito,
  label,
  valor,
  aoMudar,
  buttonId,
  formato = "quadrado",
}: {
  proposito: PropositoImagem;
  label: string;
  valor?: string;
  aoMudar: (url: string | undefined) => void;
  buttonId?: string;
  formato?: "quadrado" | "largo";
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function selecionarArquivo(arquivo: File) {
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
        {valor ? (
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
        ) : null}
      </div>
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
      {erro ? (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
