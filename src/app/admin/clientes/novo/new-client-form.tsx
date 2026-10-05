"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { criarClienteAction, type CriarClienteState } from "@/app/admin/clientes/novo/actions";
import { IconArrowLeft } from "@/components/icons";
import { CARD_TEMPLATES } from "@/lib/card/templates";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";

const estadoInicial: CriarClienteState = { error: null };

type Origem = "zero" | "modelo" | "duplicar";

/** Cadastro de cliente (PRD §60, §54, §55). */
export function NewClientForm() {
  const [state, formAction, pending] = useActionState(criarClienteAction, estadoInicial);
  const erro = useTransientMessage(state.error ? state : null, DURACAO_LEGENDA.erro)?.error;
  const [origem, setOrigem] = useState<Origem>("zero");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <Link href="/admin" className="ui-link-back w-fit">
          <IconArrowLeft />
          Voltar para a lista
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Novo cliente</h1>
      </div>

      <form action={formAction} className="ui-card flex flex-col gap-5 p-5 sm:p-6">
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="ui-label">
            Nome
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            maxLength={60}
            className="ui-input"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="username" className="ui-label">
            Nome de usuário
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            minLength={3}
            maxLength={32}
            pattern="[a-z0-9](-?[a-z0-9])*"
            title="Use de 3 a 32 caracteres: somente letras minúsculas, números e hífen (-). Comece e termine com letra ou número e não use hífens consecutivos. O sublinhado (_) não é permitido."
            aria-describedby="username-format username-permanence"
            placeholder="ex.: renan-dias"
            className="ui-input"
          />
          <p id="username-format" className="ui-hint">
            Use de 3 a 32 caracteres: letras minúsculas, números e hífen (-).
            Não use espaço, acento ou sublinhado (_). Ex.: gabriel-roberto.
          </p>
          <p id="username-permanence" className="ui-hint">
            Vira a URL pública. Não pode ser alterado depois.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="package_months" className="ui-label">
            Pacote
          </label>
          <select
            id="package_months"
            name="package_months"
            defaultValue="3"
            className="ui-input"
          >
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="12">12 meses</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="ui-label">
            Senha inicial
          </label>
          <input
            id="password"
            name="password"
            type="text"
            required
            minLength={8}
            maxLength={200}
            className="ui-input"
          />
          <p className="ui-hint">
            Anote e entregue ao cliente — não é enviada por e-mail (PRD §60).
          </p>
        </div>

        <fieldset className="space-y-2.5 border-t border-border pt-5">
          <legend className="ui-label">Aparência inicial (PRD §54, §55)</legend>
          <div className="flex flex-col gap-1 pt-1 text-sm">
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1">
              <input
                type="radio"
                name="origem_aparencia"
                checked={origem === "zero"}
                onChange={() => setOrigem("zero")}
                className="size-4 accent-primary"
              />
              Começar do zero
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1">
              <input
                type="radio"
                name="origem_aparencia"
                checked={origem === "modelo"}
                onChange={() => setOrigem("modelo")}
                className="size-4 accent-primary"
              />
              Usar um modelo
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1">
              <input
                type="radio"
                name="origem_aparencia"
                checked={origem === "duplicar"}
                onChange={() => setOrigem("duplicar")}
                className="size-4 accent-primary"
              />
              Duplicar aparência de outro cliente
            </label>
          </div>

          {origem === "modelo" ? (
            <select
              name="template_id"
              aria-label="Modelo"
              defaultValue={CARD_TEMPLATES[0]?.id}
              className="ui-input"
            >
              {CARD_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}

          {origem === "duplicar" ? (
            <div className="space-y-1.5">
              <input
                type="text"
                name="duplicate_from"
                aria-label="Nome de usuário do cliente de origem"
                placeholder="nome de usuário do cliente de origem"
                className="ui-input"
              />
              <p className="ui-hint">
                Copia cores e estrutura de botões — nunca nome, telefone, PIX,
                Wi-Fi, links ou endereço do cliente original (PRD §55).
              </p>
            </div>
          ) : null}
        </fieldset>

        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="ui-btn ui-btn-primary w-full sm:w-fit"
        >
          {pending ? "Criando…" : "Criar cliente"}
        </button>
      </form>
    </main>
  );
}
