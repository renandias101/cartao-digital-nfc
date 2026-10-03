"use client";

import { useActionState } from "react";

import { changePasswordAction, type ChangePasswordState } from "@/app/painel/actions";
import { IconLock } from "@/components/icons";

const estadoInicial: ChangePasswordState = { ok: null };

/** Formulário de troca de senha do cliente (PRD §4). */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, estadoInicial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="ui-card-title">
        <IconLock />
        Trocar senha
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <div className="space-y-1.5">
          <label htmlFor="current_password" className="ui-label">
            Senha atual
          </label>
          <input
            id="current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            className="ui-input"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="new_password" className="ui-label">
            Nova senha
          </label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={200}
            className="ui-input"
          />
        </div>
      </div>

      {state.ok === false ? (
        <p role="alert" className="text-sm text-destructive">
          {state.mensagem}
        </p>
      ) : null}
      {state.ok === true ? (
        <p role="status" className="text-sm text-success">
          Senha alterada com sucesso.
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline w-fit">
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
