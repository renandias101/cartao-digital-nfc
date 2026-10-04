"use client";

import { useId, useState } from "react";

import { IconCheck, IconSearch } from "@/components/icons";
import { SYSTEM_ICON_COMPONENTS } from "@/components/system-icons";
import { ICON_CATEGORIES, isSystemIconKey, searchIcons } from "@/lib/card/icon-catalog";

/**
 * Seletor de ícone do botão: busca em português (com sinônimos), grupos por
 * categoria e prévia de cada opção. A lista rola dentro da própria caixa,
 * então não alarga o formulário. Cada ícone aparece uma vez; o sinônimo só
 * leva à mesma opção. "Automático" limpa a escolha (`undefined`).
 *
 * `value` pode ser uma chave do sistema, uma URL de ícone enviado ou vazio;
 * só a chave do sistema marca uma opção como selecionada.
 */
export function IconPicker({
  value,
  automaticLabel,
  labelledBy,
  onChange,
}: {
  value: string | undefined;
  /** Texto da opção que limpa a escolha ("Automático" ou "Ícone enviado"). */
  automaticLabel: string;
  labelledBy: string;
  onChange: (key: string | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const results = searchIcons(query);
  const selected = isSystemIconKey(value) ? value : undefined;

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor={searchId} className="sr-only">
          Buscar ícone
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar: site, loja, agendamento…"
          autoComplete="off"
          className="ui-input pl-9"
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-2" tabIndex={-1}>
        {query === "" ? (
          <button
            type="button"
            aria-pressed={selected === undefined}
            onClick={() => onChange(undefined)}
            className={`${optionClass(selected === undefined)} mb-2 w-full flex-row justify-start gap-2 !min-h-11 px-3`}
          >
            {selected === undefined ? <IconCheck className="size-4 text-primary" /> : <span className="size-4" aria-hidden="true" />}
            {automaticLabel}
          </button>
        ) : null}

        {results.length === 0 ? (
          <p role="status" className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nenhum ícone encontrado para “{query}”.
          </p>
        ) : (
          ICON_CATEGORIES.map((category) => {
            const items = results.filter((entry) => entry.category === category.id);
            if (!items.length) return null;
            return (
              <section key={category.id} aria-label={category.label} className="mb-2 last:mb-0">
                <h4 className="px-1 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {category.label}
                </h4>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {items.map((entry) => {
                    const Icon = SYSTEM_ICON_COMPONENTS[entry.key];
                    const active = selected === entry.key;
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(entry.key)}
                        className={optionClass(active)}
                      >
                        <Icon className="size-6" />
                        <span className="w-full text-center text-[11px] leading-tight">{entry.label}</span>
                        {active ? (
                          <IconCheck className="absolute top-1 right-1 size-3.5 text-primary" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function optionClass(active: boolean): string {
  return `relative flex min-h-[4.25rem] min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-sm transition-colors ${
    active
      ? "border-primary bg-accent-soft font-medium text-foreground"
      : "border-border bg-card text-foreground hover:bg-muted"
  }`;
}
