"use client";

import { useEffect, useState, useTransition } from "react";

import {
  publicarAction,
  restaurarAction,
  salvarRascunhoAction,
  type EstadoAcao,
} from "@/app/painel/editor/actions";
import { ButtonForm } from "@/app/painel/editor/button-form";
import { ImageField } from "@/app/painel/editor/image-field";
import { PreviewPanel } from "@/app/painel/editor/preview-panel";
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconGrid,
  IconImage,
  IconPalette,
  IconPlus,
  IconUser,
} from "@/components/icons";
import {
  alternarAtivo,
  duplicarBotao,
  inserirBotaoComId,
  removerBotao,
  validarBotoes,
} from "@/lib/card/buttons";
import { validarConteudoCartao as validarCartao } from "@/lib/card/validation";
import { LIMITES_TEXTO, MAX_BOTOES } from "@/lib/constants";
import { createButtonId } from "@/lib/card/button-id";
import { getProfessionColor } from "@/lib/card/profession";
import type { CardButton, CardContent } from "@/lib/card/types";
import styles from "./editor.module.css";

const NOMES_TIPO: Record<string, string> = {
  link: "Link",
  text: "Texto",
  wifi: "Wi-Fi",
  pix: "PIX",
  phone: "Telefone",
  address: "Endereço",
};

function rotuloBotao(botao: CardButton): string {
  if (botao.title) return botao.title;
  return NOMES_TIPO[botao.type] ?? botao.type;
}

/**
 * Editor do cartão (PRD §14): dados, cores, imagens, botões, pré-visualização.
 *
 * Estado local (`content`) é o rascunho EM EDIÇÃO — só vai para o banco ao
 * clicar em "Salvar rascunho". `savedContent` guarda o último conteúdo
 * confirmado como salvo, para saber se há algo digitado ainda não salvo
 * (PRD §16, §19) e avisar antes de fechar a aba.
 */
export function CardEditor({
  initialContent,
  isActive,
}: {
  initialContent: CardContent;
  isActive: boolean;
}) {
  const [content, setContent] = useState<CardContent>(initialContent);
  const [savedContent, setSavedContent] = useState<CardContent>(initialContent);
  const [formularioBotao, setFormularioBotao] = useState<{ inicial: CardButton; criando: boolean } | null>(
    null,
  );
  const [mensagem, setMensagem] = useState<EstadoAcao>({ ok: null, mensagem: null });
  const [pending, startTransition] = useTransition();

  const sujo = JSON.stringify(content) !== JSON.stringify(savedContent);

  // PRD §19: avisar antes de sair com alterações ainda não salvas como
  // rascunho. `beforeunload` cobre fechar a aba, atualizar a página ou
  // digitar outra URL — o mecanismo padrão do navegador para isto.
  useEffect(() => {
    function aoTentarSair(e: BeforeUnloadEvent) {
      if (sujo) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", aoTentarSair);
    return () => window.removeEventListener("beforeunload", aoTentarSair);
  }, [sujo]);

  function atualizarCampo(campos: Partial<CardContent>) {
    setContent((atual) => ({ ...atual, ...campos }));
  }

  function salvarRascunho() {
    const validacaoCartao = validarCartao(content, false);
    if (!validacaoCartao.valido) {
      setMensagem({ ok: false, mensagem: validacaoCartao.mensagem });
      return;
    }
    const validacaoBotoes = validarBotoes(content.buttons);
    if (!validacaoBotoes.valido) {
      setMensagem({ ok: false, mensagem: validacaoBotoes.mensagem });
      return;
    }
    startTransition(async () => {
      try {
        const resultado = await salvarRascunhoAction(content);
        setMensagem(resultado);
        if (resultado.ok) setSavedContent(content);
      } catch {
        setMensagem({ ok: false, mensagem: "Não foi possível salvar. Seus dados continuam nesta tela. Tente novamente." });
      }
    });
  }

  function publicar() {
    if (sujo) {
      setMensagem({ ok: false, mensagem: "Salve o rascunho antes de publicar." });
      return;
    }
    startTransition(async () => {
      try {
        const resultado = await publicarAction();
        setMensagem(resultado);
      } catch {
        setMensagem({ ok: false, mensagem: "Não foi possível confirmar a publicação. Verifique sua conexão e tente novamente." });
      }
    });
  }

  function restaurar() {
    if (!confirm("Isso descarta as alterações do rascunho e volta para a última versão publicada. Continuar?")) {
      return;
    }
    startTransition(async () => {
      try {
        const resultado = await restaurarAction();
        setMensagem(resultado);
        if (resultado.ok) window.location.reload();
      } catch {
        setMensagem({ ok: false, mensagem: "Não foi possível restaurar. Seus dados continuam nesta tela. Tente novamente." });
      }
    });
  }

  function moverBotao(id: string, direcao: -1 | 1) {
    setContent((atual) => {
      const indice = atual.buttons.findIndex((b) => b.id === id);
      const novoIndice = indice + direcao;
      if (indice === -1 || novoIndice < 0 || novoIndice >= atual.buttons.length) return atual;
      const buttons = [...atual.buttons];
      const [removido] = buttons.splice(indice, 1);
      if (!removido) return atual;
      buttons.splice(novoIndice, 0, removido);
      return { ...atual, buttons };
    });
  }

  function salvarBotaoDoFormulario(botao: CardButton) {
    if (formularioBotao?.criando && content.buttons.length >= MAX_BOTOES) {
      setMensagem({ ok: false, mensagem: `Máximo de ${MAX_BOTOES} botões.` });
      return;
    }
    setContent((atual) =>
      formularioBotao?.criando
        ? inserirBotaoComId(atual, botao)
        : { ...atual, buttons: atual.buttons.map((b) => (b.id === botao.id ? botao : b)) },
    );
    setFormularioBotao(null);
  }

  if (!isActive) {
    return (
      <p className="ui-card p-5 text-sm leading-relaxed text-muted-foreground">
        Seu cartão não está ativo no momento — a edição fica disponível de
        novo assim que ele voltar a ficar ativo. Renove no painel.
      </p>
    );
  }

  return (
    <div className={styles.editorGrid}>
      <div className={styles.editColumn}>
        <div className={styles.fields} role="region" aria-label="Campos do cartão" tabIndex={0}>
        <section className={styles.section}>
          <h2 className="ui-card-title">
            <IconUser />
            Informações básicas
          </h2>
          <div className="space-y-1.5">
            <label htmlFor="displayName" className="ui-label">
              Nome exibido
            </label>
            <input
              id="displayName"
              type="text"
              value={content.displayName ?? ""}
              maxLength={LIMITES_TEXTO.nomeExibido}
              onChange={(e) => atualizarCampo({ displayName: e.target.value })}
              className="ui-input"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="profession" className="ui-label">
              Nicho / profissão
            </label>
            <input
              id="profession"
              name="profession"
              type="text"
              value={content.profession ?? ""}
              maxLength={LIMITES_TEXTO.profession}
              placeholder="Ex.: Desenvolvedor Web"
              aria-describedby="profession-hint"
              onChange={(e) => atualizarCampo({ profession: e.target.value })}
              className="ui-input"
            />
            <p id="profession-hint" className="ui-hint">Opcional. Até {LIMITES_TEXTO.profession} caracteres.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="description" className="ui-label">
              Descrição
            </label>
            <textarea
              id="description"
              value={content.description ?? ""}
              maxLength={LIMITES_TEXTO.descricaoPrincipal}
              rows={2}
              onChange={(e) => atualizarCampo({ description: e.target.value })}
              className="ui-input"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className="ui-card-title">
            <IconPalette />
            Cores e estilo
          </h2>
          <div className={styles.colorsGrid}>
            <CampoCor
              id="backgroundColor"
              label="Cor de fundo"
              valor={content.backgroundColor ?? "#ffffff"}
              aoMudar={(cor) => atualizarCampo({ backgroundColor: cor })}
            />
            <CampoCor
              id="buttonColor"
              label="Cor dos botões"
              valor={content.buttonColor ?? "#000000"}
              aoMudar={(cor) => atualizarCampo({ buttonColor: cor })}
            />
            <CampoCor
              id="professionColor"
              label="Cor de Nicho / profissão"
              valor={getProfessionColor(content)}
              aoMudar={(cor) => atualizarCampo({ professionColor: cor })}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className="ui-card-title">
            <IconImage />
            Imagens
          </h2>
          <div className={styles.imageFields}>
            <ImageField
              proposito="profile"
              label="Foto de perfil"
              valor={content.profilePhoto}
              aoMudar={(url) => atualizarCampo({ profilePhoto: url })}
            />
            <ImageField
              proposito="banner"
              label="Banner"
              formato="largo"
              valor={content.banner}
              aoMudar={(url) => atualizarCampo({ banner: url })}
            />
            <ImageField
              proposito="background"
              label="Imagem de fundo"
              formato="largo"
              valor={content.backgroundImage}
              aoMudar={(url) => atualizarCampo({ backgroundImage: url })}
            />
          </div>
        </section>

        <section className={styles.section}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="ui-card-title">
              <IconGrid />
              Botões ({content.buttons.length}/{MAX_BOTOES})
            </h2>
            {formularioBotao ? null : (
              <button
                type="button"
                disabled={content.buttons.length >= MAX_BOTOES}
                onClick={() =>
                  setFormularioBotao({
                    inicial: {
                      id: createButtonId(),
                      enabled: true,
                      type: "link",
                      title: "",
                      url: "",
                    },
                    criando: true,
                  })
                }
                className="ui-btn ui-btn-outline ui-btn-sm"
              >
                <IconPlus />
                Adicionar botão
              </button>
            )}
          </div>

          {content.buttons.length === 0 && !formularioBotao ? (
            <p className="rounded-xl border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum botão adicionado.
            </p>
          ) : null}

          {content.buttons.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {content.buttons.map((botao, indice) => (
                <li
                  key={botao.id}
                  className={styles.buttonRow}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        disabled={indice === 0}
                        onClick={() => moverBotao(botao.id, -1)}
                        className="ui-btn ui-btn-ghost ui-btn-icon"
                        aria-label="Mover para cima"
                        title="Mover para cima"
                      >
                        <IconChevronUp />
                      </button>
                      <button
                        type="button"
                        disabled={indice === content.buttons.length - 1}
                        onClick={() => moverBotao(botao.id, 1)}
                        className="ui-btn ui-btn-ghost ui-btn-icon"
                        aria-label="Mover para baixo"
                        title="Mover para baixo"
                      >
                        <IconChevronDown />
                      </button>
                    </div>
                    <span
                      // `relative`: mantém o `sr-only` (absoluto) preso dentro do
                      // rótulo truncado — sem isso ele alarga a página no celular.
                      className={`relative min-w-0 truncate font-medium ${
                        botao.enabled ? "" : "text-muted-foreground line-through"
                      }`}
                    >
                      {rotuloBotao(botao)}
                      {botao.enabled ? null : <span className="sr-only"> (desativado)</span>}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-zinc-600">
                      {NOMES_TIPO[botao.type]}
                    </span>
                  </div>
                  <div className={styles.buttonControls}>
                    <button
                      type="button"
                      onClick={() => setContent((c) => alternarAtivo(c, botao.id))}
                      className="ui-btn ui-btn-outline ui-btn-sm px-2.5"
                    >
                      {botao.enabled ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormularioBotao({ inicial: botao, criando: false })}
                      className="ui-btn ui-btn-outline ui-btn-sm px-2.5"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={content.buttons.length >= MAX_BOTOES}
                      onClick={() =>
                        setContent((c) => {
                          try {
                            return duplicarBotao(c, botao.id);
                          } catch {
                            return c;
                          }
                        })
                      }
                      className="ui-btn ui-btn-outline ui-btn-sm px-2.5"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => setContent((c) => removerBotao(c, botao.id))}
                      className="ui-btn ui-btn-danger-outline ui-btn-sm px-2.5"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {formularioBotao ? (
            <ButtonForm
              key={formularioBotao.inicial.id}
              inicial={formularioBotao.inicial}
              criando={formularioBotao.criando}
              aoSalvar={salvarBotaoDoFormulario}
              aoCancelar={() => setFormularioBotao(null)}
            />
          ) : null}
        </section>

        </div>

        <section className={styles.actionBar} aria-label="Ações do cartão">
          {mensagem.mensagem ? (
            <p
              role={mensagem.ok ? "status" : "alert"}
              className={`px-1 text-sm ${mensagem.ok ? "text-success" : "text-destructive"}`}
            >
              {mensagem.mensagem}
            </p>
          ) : null}
          <div className={styles.actionButtons}>
            <button
              type="button"
              disabled={pending || !sujo}
              onClick={salvarRascunho}
              className="ui-btn ui-btn-outline"
            >
              Salvar rascunho
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={publicar}
              className="ui-btn ui-btn-primary"
            >
              <IconCheck />
              Publicar alterações
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={restaurar}
              className="ui-btn ui-btn-outline"
            >
              Restaurar
            </button>
          </div>
        </section>
      </div>

      <aside
        aria-labelledby="titulo-previa"
        className={styles.previewColumn}
      >
        <p id="titulo-previa" className={styles.previewTitle}>
          Pré-visualização
        </p>
        <PreviewPanel content={content} />
      </aside>
    </div>
  );
}

/** Seletor de cor com amostra e o código hexadecimal visível ao lado. */
function CampoCor({
  id,
  label,
  valor,
  aoMudar,
}: {
  id: string;
  label: string;
  valor: string;
  aoMudar: (cor: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ui-label">
        {label}
      </label>
      <div className="flex min-h-[2.625rem] items-center gap-3 rounded-[var(--radius)] border border-input bg-card px-1.5">
        <input
          id={id}
          type="color"
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="ui-color"
        />
        <span className="font-mono text-sm uppercase">{valor}</span>
      </div>
    </div>
  );
}
