"use client";

import Link from "next/link";
import { useActionState } from "react";

import { forgotPasswordAction, type ForgotPasswordState } from "@/app/esqueci-senha/actions";

const INITIAL_STATE: ForgotPasswordState = { ok: null, message: null };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, INITIAL_STATE);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="space-y-2">
        <label htmlFor="recovery-username" className="ui-label">Usuário</label>
        <input id="recovery-username" name="username" type="text" required maxLength={64}
          autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={pending}
          className="ui-input" aria-describedby={state.message ? "recovery-message" : undefined} />
      </div>
      {state.message ? (
        <p id="recovery-message" role={state.ok ? "status" : "alert"}
          className={`rounded-lg p-3 text-sm leading-relaxed ${state.ok ? "bg-success-soft text-success" : "bg-red-50 text-destructive"}`}>
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="ui-btn ui-btn-primary w-full">
        {pending ? "Avisando…" : "Avisar a administração"}
      </button>
      <Link href="/login" className="ui-btn ui-btn-ghost w-full">Voltar para a entrada</Link>
    </form>
  );
}
