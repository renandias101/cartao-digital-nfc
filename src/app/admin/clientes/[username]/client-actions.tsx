"use client";

import { useActionState } from "react";

import {
  cancelarAction,
  excluirAction,
  renovarAction,
  resetSenhaAction,
  salvarNomeAction,
  salvarNotasAction,
  type AcaoState,
} from "@/app/admin/clientes/[username]/actions";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";

const ESTADO_INICIAL: AcaoState = { ok: null, mensagem: null };

function Mensagem({ estado }: { estado: AcaoState }) {
  const legenda = useTransientMessage(
    estado.ok === null ? null : estado,
    estado.ok ? DURACAO_LEGENDA.sucesso : DURACAO_LEGENDA.erro,
  );
  if (!legenda) return null;
  return (
    <p
      role={legenda.ok ? "status" : "alert"}
      className={`text-sm ${legenda.ok ? "text-success" : "text-destructive"}`}
    >
      {legenda.mensagem}
    </p>
  );
}

/** Renovar por 3, 6 ou 12 meses (PRD §29, §64). */
export function RenewForm({ clientId, username }: { clientId: string; username: string }) {
  const acao = renovarAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="months"
          defaultValue="3"
          aria-label="Período de renovação"
          className="ui-input w-auto min-w-36 flex-1 sm:flex-none"
        >
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="12">12 meses</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="ui-btn ui-btn-primary"
        >
          {pending ? "Renovando…" : "Renovar"}
        </button>
      </div>
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
      <button
        type="submit"
        disabled={pending}
        className="ui-btn ui-btn-outline w-fit"
      >
        {pending ? "Cancelando…" : "Cancelar cliente"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}

/**
 * Excluir — exige confirmação adicional (PRD §34). A caixa marcada é
 * obrigatória via validação nativa do navegador (`required`); sem ela o
 * formulário nem chega a submeter.
 */
export function DeleteSection({ clientId }: { clientId: string }) {
  const acao = excluirAction.bind(null, clientId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm">
        Essa ação apagará permanentemente a conta, o cartão e todos os dados
        vinculados.
      </p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" name="confirmar" required className="size-4 accent-destructive" />
        Entendo que esta ação é irreversível.
      </label>
      <button
        type="submit"
        disabled={pending}
        className="ui-btn ui-btn-danger w-fit"
      >
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
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          name="new_password"
          placeholder="Nova senha"
          required
          minLength={8}
          maxLength={200}
          aria-label="Nova senha"
          className="ui-input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="ui-btn ui-btn-outline"
        >
          {pending ? "Salvando…" : "Redefinir"}
        </button>
      </div>
      <Mensagem estado={estado} />
    </form>
  );
}

/** Nome do cliente (uso interno). O nome de usuário e a URL não mudam. */
export function EditNameForm({
  clientId,
  username,
  nomeAtual,
}: {
  clientId: string;
  username: string;
  nomeAtual: string;
}) {
  const acao = salvarNomeAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <label htmlFor="full_name" className="ui-label">
          Nome do cliente
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            defaultValue={nomeAtual}
            className="ui-input min-w-0 flex-1"
          />
          <button type="submit" disabled={pending} className="ui-btn ui-btn-outline">
            {pending ? "Salvando…" : "Salvar nome"}
          </button>
        </div>
        <p className="ui-hint">
          Nome usado no painel. O nome de usuário (@{username}) e a URL do cartão não mudam.
        </p>
      </div>
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
      <button
        type="submit"
        disabled={pending}
        className="ui-btn ui-btn-outline w-fit"
      >
        {pending ? "Salvando…" : "Salvar observações"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}
