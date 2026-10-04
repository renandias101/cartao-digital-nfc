"use client";

import { useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";

import { ButtonIcon } from "@/app/[username]/button-view";
import { AnchoredPopover, closeEnclosingPopover } from "@/app/painel/editor/anchored-popover";
import { ButtonForm } from "@/app/painel/editor/button-form";
import { ConfirmDialog } from "@/app/painel/editor/confirm-dialog";
import { EditorSection } from "@/app/painel/editor/editor-section";
import { useButtonDrag, type DropTarget } from "@/app/painel/editor/use-button-drag";
import {
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconDots,
  IconEdit,
  IconGrip,
  IconLayers,
  IconLink,
  IconMove,
  IconPlus,
  IconShare,
  IconTrash,
} from "@/components/icons";
import { createButtonId } from "@/lib/card/button-id";
import { alternarAtivo, duplicarBotao, inserirBotaoComId, removerBotao } from "@/lib/card/buttons";
import { getButtonLayouts, getFeaturedLinkKind, resolveButtonIcon, type ButtonLayout } from "@/lib/card/presentation";
import type { CardButton, CardContent } from "@/lib/card/types";
import { MAX_BOTOES } from "@/lib/constants";
import styles from "./editor.module.css";

const NOMES_TIPO: Record<CardButton["type"], string> = {
  link: "Link",
  text: "Texto",
  wifi: "Wi-Fi",
  pix: "PIX",
  phone: "Telefone",
  address: "Endereço",
};

/**
 * Internamente o cartão continua com dois modelos (`square` e `row`); para o
 * cliente eles são "Redes e contatos" (ícones no topo) e "Links principais"
 * (lista abaixo do Salvar Contato).
 */
const GRUPOS: Record<ButtonLayout, { titulo: string; descricao: string; vazio: string }> = {
  square: {
    titulo: "Redes e contatos",
    descricao: "Ícones de atalho no topo do cartão.",
    vazio: "Nenhum item aqui. Arraste para cá um link com ícone, como WhatsApp ou Instagram.",
  },
  row: {
    titulo: "Links principais",
    descricao: "Botões em lista, como serviços, portfólio e localização.",
    vazio: "Nenhum item aqui. Arraste um item para cá.",
  },
};

function rotuloBotao(botao: CardButton): string {
  return botao.title || NOMES_TIPO[botao.type];
}

/** Lista de botões do cartão em dois grupos, com arrastar, ativar e menu de ações. */
export function LinksEditor({
  content,
  setContent,
  onMoveButton,
  onError,
}: {
  content: CardContent;
  setContent: Dispatch<SetStateAction<CardContent>>;
  onMoveButton: (id: string, target: DropTarget) => void;
  onError: (mensagem: string) => void;
}) {
  const [formulario, setFormulario] = useState<{ inicial: CardButton; criando: boolean } | null>(null);
  const [excluindo, setExcluindo] = useState<CardButton | null>(null);
  const listaRef = useButtonDrag(onMoveButton);

  const total = content.buttons.length;
  const cheio = total >= MAX_BOTOES;
  const modelos = getButtonLayouts(content.buttons);
  const porGrupo: Record<ButtonLayout, CardButton[]> = {
    square: content.buttons.filter((b) => modelos.get(b.id) === "square"),
    row: content.buttons.filter((b) => modelos.get(b.id) === "row"),
  };

  function moverNoGrupo(id: string, direcao: -1 | 1) {
    const layout = modelos.get(id) ?? "row";
    const grupo = porGrupo[layout];
    const indice = grupo.findIndex((b) => b.id === id);
    if (indice === -1 || indice + direcao < 0 || indice + direcao >= grupo.length) return;
    const antesDe = direcao === -1 ? grupo[indice - 1] : grupo[indice + 2];
    onMoveButton(id, { layout, beforeId: antesDe?.id ?? null });
  }

  function salvarDoFormulario(botao: CardButton) {
    if (formulario?.criando && content.buttons.length >= MAX_BOTOES) {
      onError(`Máximo de ${MAX_BOTOES} botões.`);
      return;
    }
    setContent((atual) =>
      formulario?.criando
        ? inserirBotaoComId(atual, botao)
        : { ...atual, buttons: atual.buttons.map((b) => (b.id === botao.id ? botao : b)) },
    );
    setFormulario(null);
  }

  const botaoAdicionar = formulario ? null : (
    <button
      type="button"
      disabled={cheio}
      onClick={() =>
        setFormulario({
          inicial: { id: createButtonId(), enabled: true, type: "link", title: "", url: "" },
          criando: true,
        })
      }
      className="ui-btn ui-btn-primary ui-btn-sm"
    >
      <IconPlus />
      Adicionar botão
    </button>
  );

  return (
    <EditorSection
      icon={<IconLink />}
      title="Links do cartão"
      description="Adicione e organize os links que serão exibidos no seu cartão."
      action={botaoAdicionar}
    >
      <p className="ui-hint -mt-1">
        {total} de {MAX_BOTOES} botões usados
        {cheio ? " — exclua um para adicionar outro." : "."}
      </p>

      {total === 0 && !formulario ? (
        <p className="rounded-xl border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum botão adicionado. Use “Adicionar botão” para criar o primeiro.
        </p>
      ) : null}

      {total > 0 ? (
        <div ref={listaRef} className={`${styles.arrangeable} flex flex-col gap-3`}>
          {(["square", "row"] as const).map((layout) => (
            <div key={layout} data-button-zone={layout} className={styles.buttonZone}>
              <div className={styles.groupHeader}>
                <span className={styles.groupIcon} aria-hidden="true">
                  {layout === "square" ? <IconShare /> : <IconLayers />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{GRUPOS[layout].titulo}</h3>
                  <p className="text-xs text-muted-foreground">{GRUPOS[layout].descricao}</p>
                </div>
                <span className={styles.dragHint}>
                  <IconMove />
                  Arraste para reorganizar
                </span>
              </div>
              {porGrupo[layout].length === 0 ? <p className={styles.emptyZone}>{GRUPOS[layout].vazio}</p> : null}
              <ul className="flex flex-col gap-1.5">
                {porGrupo[layout].map((botao, indice, grupo) => (
                  <LinkRow
                    key={botao.id}
                    botao={botao}
                    layout={layout}
                    primeiro={indice === 0}
                    ultimo={indice === grupo.length - 1}
                    podeDuplicar={!cheio}
                    aoAlternar={() => setContent((c) => alternarAtivo(c, botao.id))}
                    aoEditar={() => setFormulario({ inicial: botao, criando: false })}
                    aoDuplicar={() =>
                      setContent((c) => {
                        try {
                          return duplicarBotao(c, botao.id);
                        } catch {
                          return c;
                        }
                      })
                    }
                    aoMover={(direcao) => moverNoGrupo(botao.id, direcao)}
                    aoTrocarGrupo={() =>
                      onMoveButton(botao.id, { layout: layout === "square" ? "row" : "square", beforeId: null })
                    }
                    aoExcluir={() => setExcluindo(botao)}
                  />
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Segure um item — aqui ou na pré-visualização — e arraste para mudar a ordem ou passar de um grupo para o
            outro.
          </p>
        </div>
      ) : null}

      {formulario ? (
        <ButtonForm
          key={formulario.inicial.id}
          inicial={formulario.inicial}
          criando={formulario.criando}
          aoSalvar={salvarDoFormulario}
          aoCancelar={() => setFormulario(null)}
        />
      ) : null}

      <ConfirmDialog
        open={excluindo !== null}
        title={excluindo ? `Excluir “${rotuloBotao(excluindo)}”?` : "Excluir botão?"}
        description="O botão sai do rascunho. O cartão publicado só muda quando você publicar."
        confirmLabel="Excluir"
        onCancel={() => setExcluindo(null)}
        onConfirm={() => {
          if (excluindo) {
            const id = excluindo.id;
            setContent((c) => removerBotao(c, id));
            if (formulario?.inicial.id === id) setFormulario(null);
          }
          setExcluindo(null);
        }}
      />
    </EditorSection>
  );
}

function LinkRow({
  botao,
  layout,
  primeiro,
  ultimo,
  podeDuplicar,
  aoAlternar,
  aoEditar,
  aoDuplicar,
  aoMover,
  aoTrocarGrupo,
  aoExcluir,
}: {
  botao: CardButton;
  layout: ButtonLayout;
  primeiro: boolean;
  ultimo: boolean;
  podeDuplicar: boolean;
  aoAlternar: () => void;
  aoEditar: () => void;
  aoDuplicar: () => void;
  aoMover: (direcao: -1 | 1) => void;
  aoTrocarGrupo: () => void;
  aoExcluir: () => void;
}) {
  const rotulo = rotuloBotao(botao);
  const outroGrupo = GRUPOS[layout === "square" ? "row" : "square"].titulo;

  return (
    <li data-button-id={botao.id} className={styles.linkRow} data-disabled={botao.enabled ? undefined : ""}>
      <span className={styles.grip} aria-hidden="true">
        <IconGrip />
      </span>
      <span className={styles.rowIcon} aria-hidden="true">
        <ButtonIcon
          button={botao}
          fallback={getFeaturedLinkKind(botao) ?? resolveButtonIcon(botao)}
          className="size-5 object-contain"
        />
      </span>
      {/* `relative`: mantém o `sr-only` (absoluto) preso dentro do rótulo truncado. */}
      <span className={styles.rowTitle}>
        {rotulo}
        {botao.enabled ? null : <span className="sr-only"> (desativado)</span>}
      </span>
      <span className={styles.typeChip}>{NOMES_TIPO[botao.type]}</span>
      <button
        type="button"
        role="switch"
        aria-checked={botao.enabled}
        aria-label={`Mostrar ${rotulo} no cartão`}
        title={botao.enabled ? "Ativo no cartão" : "Oculto no cartão"}
        onClick={aoAlternar}
        className={styles.switch}
      >
        <span aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={aoEditar}
        aria-label={`Editar ${rotulo}`}
        className={`ui-btn ui-btn-outline ui-btn-sm ${styles.editButton}`}
      >
        <IconEdit />
        <span className={styles.editLabel}>Editar</span>
      </button>
      <AnchoredPopover
        role="menu"
        label={`Ações de ${rotulo}`}
        triggerLabel={`Mais ações para ${rotulo}`}
        triggerClassName="ui-btn ui-btn-ghost ui-btn-icon"
        triggerContent={<IconDots />}
        className="w-60"
        onOpen={(panel) => panel.querySelector<HTMLElement>("[role=menuitem]:not(:disabled)")?.focus()}
      >
        <div className="flex flex-col" onKeyDown={navegarMenu}>
          <MenuItem onClick={aoDuplicar} disabled={!podeDuplicar} icon={<IconCopy />}>
            Duplicar
          </MenuItem>
          <MenuItem onClick={() => aoMover(-1)} disabled={primeiro} icon={<IconChevronUp />}>
            Mover para cima
          </MenuItem>
          <MenuItem onClick={() => aoMover(1)} disabled={ultimo} icon={<IconChevronDown />}>
            Mover para baixo
          </MenuItem>
          <MenuItem onClick={aoTrocarGrupo} icon={layout === "square" ? <IconLayers /> : <IconShare />}>
            {`Mover para “${outroGrupo}”`}
          </MenuItem>
          <hr className="my-1 border-border" />
          <MenuItem onClick={aoExcluir} icon={<IconTrash />} destructive>
            Excluir
          </MenuItem>
        </div>
      </AnchoredPopover>
    </li>
  );
}

function MenuItem({
  onClick,
  disabled,
  icon,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  destructive?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      onClick={(e) => {
        closeEnclosingPopover(e.currentTarget);
        onClick();
      }}
      className={`${styles.menuItem} ${destructive ? styles.menuItemDanger : ""}`}
    >
      {icon}
      {children}
    </button>
  );
}

/** Setas, Home e End percorrem os itens do menu (padrão ARIA de menu). */
function navegarMenu(event: KeyboardEvent<HTMLDivElement>) {
  const itens = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)"),
  );
  if (!itens.length) return;
  const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
  let proximo: number | null = null;
  if (event.key === "ArrowDown") proximo = (atual + 1) % itens.length;
  else if (event.key === "ArrowUp") proximo = (atual - 1 + itens.length) % itens.length;
  else if (event.key === "Home") proximo = 0;
  else if (event.key === "End") proximo = itens.length - 1;
  if (proximo === null) return;
  event.preventDefault();
  itens[proximo]?.focus();
}
