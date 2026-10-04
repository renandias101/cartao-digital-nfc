"use client";

import { useEffect, useRef, useState } from "react";

import { ImageField } from "@/app/painel/editor/image-field";
import { LIMITES_TEXTO } from "@/lib/constants";
import type { CardButton, ButtonType } from "@/lib/card/types";
import { TIPOS_DE_BOTAO } from "@/lib/card/types";
import { validarBotao } from "@/lib/card/buttons";
import { SYSTEM_ICONS, checkSquareEligibility, isSystemIconKey, isUploadedIcon } from "@/lib/card/presentation";

const NOMES_TIPO: Record<ButtonType, string> = {
  link: "Link personalizado",
  text: "Texto / Informação",
  wifi: "Wi-Fi",
  pix: "PIX",
  phone: "Telefone",
  address: "Endereço",
};

/**
 * Valor em branco de cada tipo — usado ao trocar de tipo ou criar um botão
 * novo. Preserva `id` e `enabled`: o id precisa existir DESDE o início (não
 * só quando o botão é salvo na lista), porque o campo de ícone já pode
 * fazer upload antes disso — sem um id estável, dois botões novos sendo
 * criados em momentos diferentes escreveriam no mesmo arquivo de ícone.
 */
function botaoEmBranco(type: ButtonType, id: string, enabled: boolean): CardButton {
  const base = { id, enabled, type } as CardButton;
  switch (type) {
    case "link":
      return { ...base, type: "link", title: "", url: "" };
    case "text":
      return { ...base, type: "text", title: "", content: "" };
    case "wifi":
      return { ...base, type: "wifi", ssid: "", password: "" };
    case "pix":
      return { ...base, type: "pix", key: "" };
    case "phone":
      return { ...base, type: "phone", number: "" };
    case "address":
      return { ...base, type: "address", address: "" };
  }
}

/**
 * Formulário de um botão — os campos mudam conforme o tipo (PRD §13). Usado
 * tanto para criar quanto para editar: `inicial` já vem com um `id` de
 * verdade nos dois casos (o chamador gera um novo id antes de abrir o
 * formulário para criação — ver `CardEditor`).
 */
export function ButtonForm({
  inicial,
  criando,
  aoSalvar,
  aoCancelar,
}: {
  inicial: CardButton;
  criando: boolean;
  aoSalvar: (botao: CardButton) => void;
  aoCancelar: () => void;
}) {
  const [botao, setBotao] = useState<CardButton>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // O formulário fica dentro da área rolável do editor, inclusive no mobile.
    formRef.current?.scrollIntoView({ block: "nearest" });
    formRef.current?.querySelector<HTMLElement>("select:not(:disabled), input")?.focus({ preventScroll: true });
  }, []);

  const elegibilidade = checkSquareEligibility(botao);
  const avisoQuadrado = botao.layout === "square" && !elegibilidade.ok ? elegibilidade.mensagem : null;

  function atualizar(campos: Partial<CardButton>) {
    setBotao((atual) => ({ ...atual, ...campos }) as CardButton);
  }

  function trocarTipo(type: ButtonType) {
    setBotao(botaoEmBranco(type, botao.id, botao.enabled));
  }

  function salvar() {
    const validacao = validarBotao(botao);
    if (!validacao.valido) {
      setErro(validacao.mensagem);
      return;
    }
    setErro(null);
    aoSalvar(botao);
  }

  return (
    <div ref={formRef} className="flex flex-col gap-4 rounded-xl border border-gold/40 bg-accent-soft/40 p-4 sm:p-5">
      <div className="space-y-1.5">
        <label htmlFor="tipo-botao" className="ui-label">
          Tipo
        </label>
        <select
          id="tipo-botao"
          value={botao.type}
          disabled={!criando}
          onChange={(e) => trocarTipo(e.target.value as ButtonType)}
          className="ui-input"
        >
          {TIPOS_DE_BOTAO.map((t) => (
            <option key={t} value={t}>
              {NOMES_TIPO[t]}
            </option>
          ))}
        </select>
        {!criando ? (
          <p className="ui-hint">
            O tipo não muda depois de criado — exclua e crie outro se precisar.
          </p>
        ) : null}
      </div>

      {(botao.type === "link" || botao.type === "text") && (
        <div className="space-y-1.5">
          <label htmlFor="titulo-botao" className="ui-label">
            Título
          </label>
          <input
            id="titulo-botao"
            type="text"
            value={botao.title}
            maxLength={LIMITES_TEXTO.tituloBotao}
            onChange={(e) => atualizar({ title: e.target.value })}
            className="ui-input"
          />
        </div>
      )}

      {botao.type !== "link" && botao.type !== "text" && (
        <div className="space-y-1.5">
          <label htmlFor="titulo-botao-opcional" className="ui-label">
            Título (opcional)
          </label>
          <input
            id="titulo-botao-opcional"
            type="text"
            value={botao.title ?? ""}
            maxLength={LIMITES_TEXTO.tituloBotao}
            placeholder={NOMES_TIPO[botao.type]}
            onChange={(e) => atualizar({ title: e.target.value || undefined })}
            className="ui-input"
          />
        </div>
      )}

      {botao.type === "link" && (
        <div className="space-y-1.5">
          <label htmlFor="url-botao" className="ui-label">
            URL
          </label>
          <input
            id="url-botao"
            type="text"
            value={botao.url}
            placeholder="https://…"
            onChange={(e) => atualizar({ url: e.target.value })}
            className="ui-input"
          />
        </div>
      )}

      {(botao.type === "link" || botao.type === "text") && (
        <div className="space-y-1.5">
          <label htmlFor="descricao-botao" className="ui-label">
            Descrição (opcional)
          </label>
          <input
            id="descricao-botao"
            type="text"
            value={botao.description ?? ""}
            maxLength={LIMITES_TEXTO.descricaoBotao}
            onChange={(e) => atualizar({ description: e.target.value || undefined })}
            className="ui-input"
          />
        </div>
      )}

      {botao.type === "text" && (
        <div className="space-y-1.5">
          <label htmlFor="conteudo-botao" className="ui-label">
            Conteúdo
          </label>
          <textarea
            id="conteudo-botao"
            value={botao.content}
            rows={4}
            maxLength={LIMITES_TEXTO.textoInformativo}
            onChange={(e) => atualizar({ content: e.target.value })}
            className="ui-input"
          />
        </div>
      )}

      {botao.type === "wifi" && (
        <>
          <div className="space-y-1.5">
            <label htmlFor="ssid-botao" className="ui-label">
              Nome da rede (SSID)
            </label>
            <input
              id="ssid-botao"
              type="text"
              value={botao.ssid}
              onChange={(e) => atualizar({ ssid: e.target.value })}
              className="ui-input"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="senha-botao" className="ui-label">
              Senha
            </label>
            <input
              id="senha-botao"
              type="text"
              value={botao.password}
              onChange={(e) => atualizar({ password: e.target.value })}
              className="ui-input"
            />
          </div>
        </>
      )}

      {botao.type === "pix" && (
        <div className="space-y-1.5">
          <label htmlFor="chave-botao" className="ui-label">
            Chave PIX
          </label>
          <input
            id="chave-botao"
            type="text"
            value={botao.key}
            onChange={(e) => atualizar({ key: e.target.value })}
            className="ui-input"
          />
        </div>
      )}

      {botao.type === "phone" && (
        <div className="space-y-1.5">
          <label htmlFor="numero-botao" className="ui-label">
            Número
          </label>
          <input
            id="numero-botao"
            type="text"
            value={botao.number}
            onChange={(e) => atualizar({ number: e.target.value })}
            className="ui-input"
          />
        </div>
      )}

      {botao.type === "address" && (
        <div className="space-y-1.5">
          <label htmlFor="endereco-botao" className="ui-label">
            Endereço
          </label>
          <textarea
            id="endereco-botao"
            value={botao.address}
            rows={2}
            onChange={(e) => atualizar({ address: e.target.value })}
            className="ui-input"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="modelo-botao" className="ui-label">
          Onde aparece
        </label>
        <select
          id="modelo-botao"
          value={botao.layout ?? ""}
          onChange={(e) => atualizar({ layout: (e.target.value || undefined) as CardButton["layout"] })}
          aria-describedby="modelo-botao-ajuda"
          className="ui-input"
        >
          <option value="">Automático (redes sociais em “Redes e contatos”)</option>
          <option value="square">Redes e contatos (ícone no topo)</option>
          <option value="row">Links principais (lista)</option>
        </select>
        <p id="modelo-botao-ajuda" aria-live="polite"
          className={`text-xs ${avisoQuadrado ? "text-destructive" : "text-muted-foreground"}`}>
          {avisoQuadrado ?? "“Redes e contatos” é para links de um toque que tenham logo, como WhatsApp e Instagram."}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="icone-botao" className="ui-label">
          Ícone
        </label>
        <select
          id="icone-botao"
          value={isSystemIconKey(botao.icon) ? botao.icon : ""}
          onChange={(e) => atualizar({ icon: e.target.value || undefined })}
          aria-describedby="icone-botao-ajuda"
          className="ui-input"
        >
          <option value="">{isUploadedIcon(botao.icon) ? "Ícone enviado" : "Automático"}</option>
          {Object.entries(SYSTEM_ICONS).map(([key, nome]) => (
            <option key={key} value={key}>
              {nome}
            </option>
          ))}
        </select>
        <p id="icone-botao-ajuda" className="text-xs text-muted-foreground">
          Automático escolhe pelo tipo e pelo título. Um ícone enviado abaixo tem prioridade.
        </p>
      </div>

      <ImageField
        proposito="icon"
        label="Ícone personalizado (opcional)"
        valor={isUploadedIcon(botao.icon) ? botao.icon : undefined}
        aoMudar={(url) => atualizar({ icon: url })}
        buttonId={botao.id}
      />

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={salvar}
          className="ui-btn ui-btn-primary"
        >
          {criando ? "Adicionar botão" : "Salvar botão"}
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          className="ui-btn ui-btn-outline"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
