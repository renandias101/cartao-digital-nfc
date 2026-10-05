"use client";

import { useActionState, useState } from "react";

import { salvarRodapeAction, type SalvarRodapeState } from "@/app/admin/rodape/actions";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";
import { LIMITES_RODAPE, type CardFooterSettings } from "@/lib/system/card-footer";

const estadoInicial: SalvarRodapeState = { ok: null, mensagem: null };

/** Formulário do rodapé, com uma amostra de como fica no cartão. */
export function FooterForm({ initial }: { initial: CardFooterSettings }) {
  const [state, formAction, pending] = useActionState(salvarRodapeAction, estadoInicial);
  const [valores, setValores] = useState(initial);
  const legenda = useTransientMessage(
    state.mensagem ? state : null,
    state.ok ? DURACAO_LEGENDA.sucesso : DURACAO_LEGENDA.erro,
  );
  const campo = (nome: keyof Omit<CardFooterSettings, "enabled">) => ({
    id: nome,
    name: nome,
    value: valores[nome],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValores((v) => ({ ...v, [nome]: e.target.value })),
    className: "ui-input",
  });

  return (
    <form action={formAction} className="ui-card flex flex-col gap-5 p-5 sm:p-6">
      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="enabled"
          checked={valores.enabled}
          onChange={(e) => setValores((v) => ({ ...v, enabled: e.target.checked }))}
          className="size-4 accent-primary"
        />
        Exibir o rodapé nos cartões
      </label>

      <div className="space-y-1.5">
        <label htmlFor="title" className="ui-label">Título</label>
        <input type="text" required maxLength={LIMITES_RODAPE.title} {...campo("title")} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="subtitle" className="ui-label">Subtítulo</label>
        <input type="text" maxLength={LIMITES_RODAPE.subtitle} {...campo("subtitle")} />
        <p className="ui-hint">Opcional.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="buttonLabel" className="ui-label">Texto do botão</label>
        <input type="text" required maxLength={LIMITES_RODAPE.buttonLabel} {...campo("buttonLabel")} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="url" className="ui-label">Link do botão</label>
        <input
          type="url"
          required
          maxLength={LIMITES_RODAPE.url}
          placeholder="https://wa.me/55..."
          aria-describedby="url-hint"
          {...campo("url")}
        />
        <p id="url-hint" className="ui-hint">
          Endereço completo, começando com https://. Ex.: um link de WhatsApp (https://wa.me/55…) ou do seu site.
        </p>
      </div>

      <div className="rounded-xl bg-[#0c0c0d] p-4 text-white" aria-label="Amostra do rodapé">
        <p className="mb-3 text-xs uppercase tracking-wide text-white/50">Amostra</p>
        {valores.enabled ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#fdc158]/40 pt-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{valores.title || "Título"}</p>
              {valores.subtitle ? <p className="mt-0.5 text-xs text-white/70">{valores.subtitle}</p> : null}
            </div>
            <span className="rounded-full border border-[#fdc158] px-4 py-2 text-xs font-semibold text-[#fdc158]">
              {valores.buttonLabel || "Botão"} ›
            </span>
          </div>
        ) : (
          <p className="text-sm text-white/70">Rodapé oculto: os cartões terminam nos botões do cliente.</p>
        )}
      </div>

      {legenda ? (
        <p role={legenda.ok ? "status" : "alert"} className={`text-sm ${legenda.ok ? "text-success" : "text-destructive"}`}>
          {legenda.mensagem}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="ui-btn ui-btn-primary">
          {pending ? "Salvando…" : "Salvar rodapé"}
        </button>
      </div>
    </form>
  );
}
