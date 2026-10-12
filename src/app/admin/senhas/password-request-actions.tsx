"use client";

import { useActionState } from "react";

import { closePasswordRequestAction, fulfillPasswordRequestAction, type PasswordRequestActionState } from "@/app/admin/senhas/actions";

const INITIAL: PasswordRequestActionState = { ok: null, message: null };

function Message({ state }: { state: PasswordRequestActionState }) {
  return state.message ? <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-success" : "text-destructive"}`}>{state.message}</p> : null;
}

export function PasswordRequestActions({ id }: { id: number }) {
  const [resetState, resetAction, resetPending] = useActionState(fulfillPasswordRequestAction.bind(null, id), INITIAL);
  const [closeState, closeAction, closePending] = useActionState(closePasswordRequestAction.bind(null, id), INITIAL);
  return (
    <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
      <form action={resetAction} className="flex flex-col gap-2">
        <label htmlFor={`new-password-${id}`} className="ui-label">Nova senha</label>
        <input id={`new-password-${id}`} name="new_password" type="text" required minLength={8} maxLength={200}
          autoComplete="off" spellCheck={false} disabled={resetPending || closePending} className="ui-input" />
        <button type="submit" disabled={resetPending || closePending} className="ui-btn ui-btn-primary">
          {resetPending ? "Redefinindo…" : "Redefinir e atender"}
        </button>
        <Message state={resetState} />
      </form>
      <form action={closeAction} className="flex flex-col gap-2">
        <label htmlFor={`reason-${id}`} className="ui-label">Motivo para encerrar sem redefinir</label>
        <textarea id={`reason-${id}`} name="reason" required minLength={3} maxLength={500} rows={2}
          disabled={resetPending || closePending} className="ui-input" />
        <button type="submit" disabled={resetPending || closePending} className="ui-btn ui-btn-outline">
          {closePending ? "Encerrando…" : "Encerrar sem redefinir"}
        </button>
        <Message state={closeState} />
      </form>
    </div>
  );
}
