"use client";

import { useActionState } from "react";

import {
  cancelarAction,
  excluirAction,
  renovarAction,
  resetSenhaAction,
  salvarDadosAction,
  salvarNotasAction,
  type AcaoState,
} from "@/app/admin/clientes/[username]/actions";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";
import { FORMAS_PAGAMENTO } from "@/lib/admin/payments";

const ESTADO_INICIAL: AcaoState = { ok: null, mensagem: null };

function Mensagem({ estado }: { estado: AcaoState }) {
  const legenda = useTransientMessage(
    estado.ok === null ? null : estado,
    estado.ok ? DURACAO_LEGENDA.sucesso : DURACAO_LEGENDA.erro,
  );
  if (!legenda) return null;
  return (
    <p role={legenda.ok ? "status" : "alert"} className={`text-sm ${legenda.ok ? "text-success" : "text-destructive"}`}>
      {legenda.mensagem}
    </p>
  );
}

/**
 * Renovar por 3, 6 ou 12 meses (PRD §29, §64). O pagamento é opcional e fica
 * recolhido: renovar não depende de informar valor.
 */
export function RenewForm({ clientId, username, hoje }: { clientId: string; username: string; hoje: string }) {
  const acao = renovarAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select name="months" defaultValue="3" aria-label="Período de renovação" className="ui-input w-auto min-w-36 flex-1 sm:flex-none">
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="12">12 meses</option>
        </select>
        <button type="submit" disabled={pending} className="ui-btn ui-btn-primary">
          {pending ? "Renovando…" : "Renovar"}
        </button>
      </div>

      <details className="rounded-xl border border-border px-3 py-2 text-sm">
        <summary className="cursor-pointer py-1 font-medium">Registrar pagamento (opcional)</summary>
        <div className="grid gap-3 pt-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="amount" className="ui-label">Valor recebido</label>
            <input id="amount" name="amount" inputMode="decimal" placeholder="120,00" autoComplete="off" className="ui-input" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="method" className="ui-label">Forma de pagamento</label>
            <select id="method" name="method" defaultValue="" className="ui-input">
              <option value="">—</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>{f.rotulo}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="paid_on" className="ui-label">Data do pagamento</label>
            <input id="paid_on" name="paid_on" type="date" defaultValue={hoje} className="ui-input" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="payment_note" className="ui-label">Observação</label>
            <input id="payment_note" name="payment_note" maxLength={500} autoComplete="off" className="ui-input" />
          </div>
        </div>
      </details>
      <Mensagem estado={estado} />
    </form>
  );
}

/** Cancelar manualmente, de qualquer status (PRD §33, decisão P3). */
export function CancelButton({ clientId, username }: { clientId: string; username: string }) {
  const acao = cancelarAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline w-fit">
        {pending ? "Cancelando…" : "Cancelar cliente"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}

/**
 * Exclusão definitiva — só aparece quando o cliente já está elegível (3 meses
 * cancelado); o banco confere de novo. Exige marcar a confirmação.
 */
export function DeleteSection({ clientId, username }: { clientId: string; username: string }) {
  const acao = excluirAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" name="confirmar" required className="size-4 accent-destructive" />
        Entendo que esta ação é irreversível.
      </label>
      <button type="submit" disabled={pending} className="ui-btn ui-btn-danger w-fit">
        {pending ? "Excluindo…" : "Excluir permanentemente"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}

/** Redefinir senha (PRD §4). */
export function ResetPasswordForm({ clientId, username }: { clientId: string; username: string }) {
  const acao = resetSenhaAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          name="new_password"
          type="password"
          required
          minLength={8}
          maxLength={200}
          placeholder="Nova senha"
          autoComplete="new-password"
          aria-label="Nova senha"
          className="ui-input min-w-0 flex-1"
        />
        <button type="submit" disabled={pending} className="ui-btn ui-btn-outline">
          {pending ? "Salvando…" : "Redefinir"}
        </button>
      </div>
      <Mensagem estado={estado} />
    </form>
  );
}

/**
 * Dados administrativos: nome (uso interno) e contato. Nada disso vai para o
 * cartão, o vCard ou o painel do cliente. O nome de usuário e a URL não mudam.
 */
export function ClientDataForm({
  clientId,
  username,
  nomeAtual,
  whatsapp,
  email,
}: {
  clientId: string;
  username: string;
  nomeAtual: string;
  whatsapp: string | null;
  email: string | null;
}) {
  const acao = salvarDadosAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <label htmlFor="full_name" className="ui-label">Nome do cliente</label>
        <input id="full_name" name="full_name" type="text" required minLength={2} maxLength={120}
          defaultValue={nomeAtual} className="ui-input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="whatsapp" className="ui-label">WhatsApp de contato</label>
          <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" placeholder="(96) 98123-3398"
            defaultValue={whatsapp ?? ""} autoComplete="off" className="ui-input" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="ui-label">E-mail (opcional)</label>
          <input id="email" name="email" type="email" maxLength={254} defaultValue={email ?? ""}
            autoComplete="off" className="ui-input" />
        </div>
      </div>
      <p className="ui-hint">
        Uso interno, para falar com o cliente sobre renovação e suporte. Não aparece no cartão nem para o cliente.
        O nome de usuário (@{username}) e a URL do cartão não mudam.
      </p>
      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline w-fit">
        {pending ? "Salvando…" : "Salvar dados"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}

/** Observações internas (PRD §39) — nunca visíveis ao cliente. */
export function NotesForm({
  clientId,
  username,
  observacoesIniciais,
}: {
  clientId: string;
  username: string;
  observacoesIniciais: string;
}) {
  const acao = salvarNotasAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="notes"
        defaultValue={observacoesIniciais}
        rows={4}
        maxLength={2000}
        placeholder="Observações privadas sobre este cliente…"
        aria-label="Observações internas"
        className="ui-input"
      />
      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline w-fit">
        {pending ? "Salvando…" : "Salvar observações"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}
