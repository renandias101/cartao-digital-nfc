"use client";

import { useActionState } from "react";

import { changePasswordAction, type ChangePasswordState } from "@/app/painel/actions";
import { IconLock } from "@/components/icons";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";

const estadoInicial: ChangePasswordState = { ok: null };

/**
 * Troca de senha do cliente (PRD §4). Continua exigindo a senha atual; a
 * confirmação evita trancar a conta por erro de digitação.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, estadoInicial);
  const legenda = useTransientMessage(
    state.ok === null ? null : state,
    state.ok ? DURACAO_LEGENDA.sucesso : DURACAO_LEGENDA.erro,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <IconLock className="size-4 text-gold" />
          Redefinição de senha
        </h3>
        <p className="text-xs text-muted-foreground">Defina uma nova senha para acessar e editar o seu cartão.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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
            placeholder="Mínimo de 8 caracteres"
            className="ui-input"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm_password" className="ui-label">
            Confirmar nova senha
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={200}
            className="ui-input"
          />
        </div>
      </div>

      {legenda?.ok === false ? (
        <p role="alert" className="text-sm text-destructive">
          {legenda.mensagem}
        </p>
      ) : null}
      {legenda?.ok === true ? (
        <p role="status" className="text-sm text-success">
          Senha alterada com sucesso.
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline ui-btn-sm w-fit">
        <IconLock />
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
