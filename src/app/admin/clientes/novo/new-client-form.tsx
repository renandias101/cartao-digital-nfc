"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { criarClienteAction, type CriarClienteState } from "@/app/admin/clientes/novo/actions";
import { IconArrowLeft } from "@/components/icons";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";
import { FORMAS_PAGAMENTO } from "@/lib/admin/payments";
import type { ClienteParaDuplicacao } from "@/lib/admin/clients";
import { DEFAULT_TEMPLATE_USERNAME } from "@/lib/constants";

const estadoInicial: CriarClienteState = { error: null };

type Origem = "zero" | "modelo" | "duplicar";

/** Cadastro de cliente (PRD §60, §54, §55). */
export function NewClientForm({ hoje, clientes }: { hoje: string; clientes: ClienteParaDuplicacao[] }) {
  const [state, formAction, pending] = useActionState(criarClienteAction, estadoInicial);
  const erro = useTransientMessage(state.error ? state : null, DURACAO_LEGENDA.erro)?.error;
  const [origem, setOrigem] = useState<Origem>("zero");
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteParaDuplicacao | null>(null);
  const listaRef = useRef<HTMLDetailsElement>(null);

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
            Vira a URL pública. O cliente não pode alterá-la; somente o administrador pode mudar o endereço, preservando o anterior.
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
                {FORMAS_PAGAMENTO.map((forma) => (
                  <option key={forma.valor} value={forma.valor}>{forma.rotulo}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="paid_on" className="ui-label">Data do pagamento</label>
              <input id="paid_on" name="paid_on" type="date" defaultValue={hoje} className="ui-input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="payment_note" className="ui-label">Observação</label>
              <textarea id="payment_note" name="payment_note" maxLength={500} rows={2} className="ui-input" />
            </div>
          </div>
        </details>

        <fieldset className="space-y-2.5 border-t border-border pt-5">
          <legend className="ui-label">Aparência inicial (PRD §54, §55)</legend>
          <div className="flex flex-col gap-1 pt-1 text-sm">
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1">
              <input
                type="radio"
                name="origem_aparencia"
                value="zero"
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
                value="modelo"
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
                value="duplicar"
                checked={origem === "duplicar"}
                onChange={() => setOrigem("duplicar")}
                className="size-4 accent-primary"
              />
              Duplicar aparência de outro cliente
            </label>
          </div>

          {origem === "modelo" ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <input type="hidden" name="duplicate_from" value={DEFAULT_TEMPLATE_USERNAME} />
              <span className="font-semibold">Modelo padrão</span>
              <span className="ml-2 text-muted-foreground">@{DEFAULT_TEMPLATE_USERNAME}</span>
              <p className="ui-hint mt-1">Usa a aparência atual deste cartão, sem copiar dados pessoais.</p>
            </div>
          ) : null}

          {origem === "duplicar" ? (
            <div className="space-y-1.5">
              <input type="hidden" name="duplicate_from" value={clienteSelecionado?.username ?? ""} />
              <details ref={listaRef} className="rounded-xl border border-border bg-background">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 font-medium marker:hidden">
                  <span className="min-w-0 truncate">
                    {clienteSelecionado
                      ? `${clienteSelecionado.full_name} (@${clienteSelecionado.username})`
                      : "Selecionar cartão para duplicar"}
                  </span>
                  <span aria-hidden="true">▾</span>
                </summary>
                <div className="max-h-72 space-y-1 overflow-y-auto border-t border-border p-2">
                  {clientes.length === 0 ? (
                    <p className="px-2 py-3 text-muted-foreground">Nenhum cartão disponível.</p>
                  ) : clientes.map((cliente) => (
                    <button
                      key={cliente.id}
                      type="button"
                      aria-pressed={clienteSelecionado?.id === cliente.id}
                      onClick={() => {
                        setClienteSelecionado(cliente);
                        if (listaRef.current) listaRef.current.open = false;
                      }}
                      className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors ${
                        clienteSelecionado?.id === cliente.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted focus-visible:bg-muted"
                      }`}
                    >
                      <span className="font-medium">{cliente.full_name}</span>
                      <span className={clienteSelecionado?.id === cliente.id ? "text-primary-foreground/80" : "text-muted-foreground"}>
                        @{cliente.username}
                      </span>
                    </button>
                  ))}
                </div>
              </details>
              {!clienteSelecionado ? <p className="text-sm text-destructive">Selecione um cartão antes de criar.</p> : null}
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
