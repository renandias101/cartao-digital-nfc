"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { publicarAction, restaurarAction, type EstadoAcao } from "@/app/painel/editor/actions";
import { AppearanceSection } from "@/app/painel/editor/appearance-section";
import { DraftActions } from "@/app/painel/editor/draft-actions";
import { LinksEditor } from "@/app/painel/editor/links-editor";
import { PreviewPanel } from "@/app/painel/editor/preview-panel";
import { ProfileSection } from "@/app/painel/editor/profile-section";
import type { DropTarget } from "@/app/painel/editor/use-button-drag";
import { useDraftAutosave } from "@/app/painel/editor/use-draft-autosave";
import { moveButtonToLayout } from "@/lib/card/presentation";
import type { CardContent } from "@/lib/card/types";
import type { CardFooter } from "@/lib/system/card-footer";
import styles from "./editor.module.css";

/**
 * Editor do cartão (PRD §14): perfil, cores, imagens, botões e prévia.
 *
 * `content` é o rascunho EM EDIÇÃO. Ele é gravado em `card_drafts` sozinho,
 * pouco depois de cada alteração (`useDraftAutosave`, mesma Server Action do
 * salvamento manual); a página pública só muda ao publicar (PRD §16, §17).
 * `passwordForm` entra como subseção do Perfil, mas continua independente
 * do rascunho.
 */
export function CardEditor({
  initialContent,
  isActive,
  hasUnpublishedChanges = false,
  passwordForm,
  footer,
}: {
  initialContent: CardContent;
  isActive: boolean;
  hasUnpublishedChanges?: boolean;
  passwordForm?: ReactNode;
  /** Rodapé do sistema: só aparece na prévia, o cliente não edita. */
  footer?: CardFooter | null;
}) {
  const [content, setContent] = useState<CardContent>(initialContent);
  const [publicadoEm, setPublicadoEm] = useState<Date | null>(null);
  const [mensagem, setMensagem] = useState<EstadoAcao>({ ok: null, mensagem: null });
  const [pending, startTransition] = useTransition();
  const { state: salvamento, saveNow, pause, resume } = useDraftAutosave(content, initialContent, isActive);
  const saindoDeProposito = useRef(false);

  // Rascunho gravado depois da última publicação = alterações não publicadas.
  const { savedAt } = salvamento;
  const naoPublicado =
    savedAt && (!publicadoEm || savedAt > publicadoEm) ? true : publicadoEm ? false : hasUnpublishedChanges;

  // PRD §19 (D57): avisar antes de sair com alterações ainda não gravadas
  // como rascunho — fechar a aba, atualizar ou digitar outra URL.
  const sujo = salvamento.dirty;
  useEffect(() => {
    function aoTentarSair(e: BeforeUnloadEvent) {
      if (sujo && !saindoDeProposito.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", aoTentarSair);
    return () => window.removeEventListener("beforeunload", aoTentarSair);
  }, [sujo]);

  function atualizarCampo(campos: Partial<CardContent>) {
    setContent((atual) => ({ ...atual, ...campos }));
  }

  function salvarAgora() {
    startTransition(async () => {
      setMensagem(await saveNow(content));
    });
  }

  function publicar() {
    startTransition(async () => {
      try {
        // Publica exatamente o que está na tela: grava antes o que faltar.
        if (salvamento.dirty || salvamento.error) {
          const salvo = await saveNow(content);
          if (!salvo.ok) {
            setMensagem(salvo);
            return;
          }
        }
        const resultado = await publicarAction();
        setMensagem(resultado);
        if (resultado.ok) setPublicadoEm(new Date());
      } catch {
        setMensagem({ ok: false, mensagem: "Não foi possível confirmar a publicação. Verifique sua conexão e tente novamente." });
      }
    });
  }

  function descartar() {
    startTransition(async () => {
      // Nenhuma gravação automática pode chegar depois da restauração.
      await pause();
      try {
        const resultado = await restaurarAction();
        setMensagem(resultado);
        if (resultado.ok) {
          saindoDeProposito.current = true;
          window.location.reload();
          return;
        }
      } catch {
        setMensagem({ ok: false, mensagem: "Não foi possível descartar. Seus dados continuam nesta tela. Tente novamente." });
      }
      resume();
    });
  }

  /** Arrastar (lista ou prévia), "Mover para cima/baixo" e troca de grupo. */
  function moverParaModelo(id: string, { layout, beforeId }: DropTarget) {
    const resultado = moveButtonToLayout(content.buttons, id, layout, beforeId);
    if (!resultado.ok) {
      setMensagem({ ok: false, mensagem: resultado.mensagem });
      return;
    }
    setContent({ ...content, buttons: resultado.buttons });
  }

  if (!isActive) {
    return (
      <div className="flex flex-col gap-4">
        <p className="ui-card p-5 text-sm leading-relaxed text-muted-foreground">
          Seu cartão não está ativo no momento — a edição fica disponível de
          novo assim que ele voltar a ficar ativo. Renove pelo WhatsApp.
        </p>
        {passwordForm ? <div className="ui-card p-5 sm:p-6">{passwordForm}</div> : null}
      </div>
    );
  }

  return (
    <div className={styles.editorGrid}>
      <div className={styles.editColumn}>
        <div className={styles.fields}>
          <ProfileSection content={content} onChange={atualizarCampo} passwordForm={passwordForm} />
          <AppearanceSection content={content} onChange={atualizarCampo} />
          <LinksEditor
            content={content}
            setContent={setContent}
            onMoveButton={moverParaModelo}
            onError={(texto) => setMensagem({ ok: false, mensagem: texto })}
          />
        </div>

        <DraftActions
          saveState={salvamento}
          hasUnpublishedChanges={naoPublicado}
          pending={pending}
          message={mensagem}
          onSaveNow={salvarAgora}
          onPublish={publicar}
          onDiscard={descartar}
        />
      </div>

      <PreviewPanel content={content} footer={footer} onMoveButton={moverParaModelo} />
    </div>
  );
}
