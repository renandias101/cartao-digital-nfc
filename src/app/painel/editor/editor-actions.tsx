"use client";

import { createContext, useContext } from "react";

import {
  enviarImagemAction,
  publicarAction,
  restaurarAction,
  salvarRascunhoAction,
  type EstadoAcao,
  type ResultadoUploadAction,
} from "@/app/painel/editor/actions";
import type { PropositoImagem } from "@/lib/card/image-processing";
import type { CardContent } from "@/lib/card/types";

/**
 * O que o editor faz no servidor. O mesmo `CardEditor` serve ao cliente
 * (padrão abaixo, sobre o próprio cartão) e ao administrador (ações que já
 * chegam presas ao cliente alvo — ver `admin/clientes/[username]/cartao`).
 * A autorização fica em cada Server Action e no banco, nunca aqui.
 */
export type EditorActions = {
  salvarRascunho: (content: CardContent) => Promise<EstadoAcao>;
  publicar: () => Promise<EstadoAcao>;
  restaurar: () => Promise<EstadoAcao>;
  enviarImagem: (proposito: PropositoImagem, formData: FormData, buttonId?: string) => Promise<ResultadoUploadAction>;
};

export const ACOES_DO_CLIENTE: EditorActions = {
  salvarRascunho: salvarRascunhoAction,
  publicar: publicarAction,
  restaurar: restaurarAction,
  enviarImagem: enviarImagemAction,
};

const EditorActionsContext = createContext<EditorActions>(ACOES_DO_CLIENTE);

export const EditorActionsProvider = EditorActionsContext.Provider;

/** Para componentes internos do editor (ex.: envio de imagem). */
export function useEditorActions(): EditorActions {
  return useContext(EditorActionsContext);
}
