"use client";

import { useActionState } from "react";

import {
  alterarStatusSuporteAction,
  classificarSuporteAction,
  type SuporteActionState,
} from "@/app/admin/suporte/actions";
import { IconCheck, IconUndo } from "@/components/icons";
import { CATEGORIAS_SUPORTE, type CategoriaSuporte, type PrioridadeSuporte } from "@/lib/support/categories";

const INICIAL: SuporteActionState = { ok: null, mensagem: null };

function Feedback({ state }: { state: SuporteActionState }) {
  if (state.ok === null || !state.mensagem) return null;
  return <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-success" : "text-sm text-destructive"}>{state.mensagem}</p>;
}

export function SupportClassificationForm({
  id, categoria, prioridade, anotacao,
}: { id: number; categoria: CategoriaSuporte; prioridade: PrioridadeSuporte; anotacao: string | null }) {
  const [state, action, pending] = useActionState(classificarSuporteAction.bind(null, id), INICIAL);
  return (
    <form action={action} className="flex flex-col gap-3 pt-3" aria-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`categoria-${id}`} className="ui-label">Classificação</label>
          <select id={`categoria-${id}`} name="categoria" defaultValue={categoria} disabled={pending} className="ui-input">
            {CATEGORIAS_SUPORTE.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`prioridade-${id}`} className="ui-label">Prioridade</label>
          <select id={`prioridade-${id}`} name="prioridade" defaultValue={prioridade} disabled={pending} className="ui-input">
            <option value="normal">Normal</option><option value="alta">Alta</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`anotacao-${id}`} className="ui-label">Anotação interna</label>
        <textarea id={`anotacao-${id}`} name="anotacao" rows={2} maxLength={2000} defaultValue={anotacao ?? ""} disabled={pending} className="ui-input" />
        <p className="ui-hint">Nunca aparece para o cliente.</p>
      </div>
      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline ui-btn-sm w-fit">{pending ? "Salvando…" : "Salvar atendimento"}</button>
      <Feedback state={state} />
    </form>
  );
}

export function SupportStatusForm({ id, resolvido }: { id: number; resolvido: boolean }) {
  const [state, action, pending] = useActionState(alterarStatusSuporteAction.bind(null, id, resolvido), INICIAL);
  return (
    <form action={action} className="flex flex-col items-start gap-2" aria-busy={pending}>
      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline ui-btn-sm">
        {resolvido ? <IconCheck /> : <IconUndo />}
        {pending ? "Salvando…" : resolvido ? "Marcar como resolvido" : "Reabrir"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
