"use client";

import { useActionState, useRef, useState } from "react";

import {
  alterarUsernameAction,
  cancelarAction,
  excluirAction,
  registrarAuditoriaSenhaAction,
  renovarAction,
  resetSenhaAction,
  salvarDadosAction,
  salvarNotasAction,
  type AcaoState,
} from "@/app/admin/clientes/[username]/actions";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";
import { ConfirmDialog } from "@/app/painel/editor/confirm-dialog";
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

function AuditRetry({ clientId }: { clientId: string }) {
  const [estado, action, pending] = useActionState(registrarAuditoriaSenhaAction.bind(null, clientId), ESTADO_INICIAL);
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="submit" formAction={action} formNoValidate disabled={pending} className="ui-btn ui-btn-outline ui-btn-sm">
        {pending ? "Registrando…" : "Tentar registrar auditoria novamente"}
      </button>
      <Mensagem estado={estado} />
    </div>
  );
}

/** Cancelar manualmente, de qualquer status (PRD §33, decisão P3). */
export function CancelButton({ clientId, username, clientName }: { clientId: string; username: string; clientName: string }) {
  const acao = cancelarAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);
  const [confirmando, setConfirmando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <button type="button" onClick={() => setConfirmando(true)} disabled={pending} className="ui-btn ui-btn-outline w-fit">
        {pending ? "Cancelando…" : "Cancelar cliente"}
      </button>
      <Mensagem estado={estado} />
      <ConfirmDialog
        open={confirmando}
        title={`Cancelar ${clientName}?`}
        description={`O cartão de @${username} sairá do ar imediatamente e visitantes verão uma página neutra. Para reativá-lo, será necessário renovar o cliente.`}
        confirmLabel="Sim, cancelar cliente"
        onCancel={() => setConfirmando(false)}
        onConfirm={() => {
          setConfirmando(false);
          formRef.current?.requestSubmit();
        }}
      />
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
      {estado.auditoriaPendente ? <AuditRetry clientId={clientId} /> : null}
    </form>
  );
}

/**
 * Dados administrativos: nome (uso interno) e contato. Nada disso vai para o
 * cartão, o vCard ou o painel do cliente.
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
        O cliente não pode alterar seu nome de usuário. A mudança administrativa da URL fica na seção própria.
      </p>
      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline w-fit">
        {pending ? "Salvando…" : "Salvar dados"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}

export function UsernameChangeForm({
  clientId,
  username,
  currentUrl,
}: {
  clientId: string;
  username: string;
  currentUrl: string;
}) {
  const acao = alterarUsernameAction.bind(null, clientId, username);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_INICIAL);
  const [novoUsername, setNovoUsername] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmadoRef = useRef(false);
  const origin = currentUrl.slice(0, currentUrl.length - username.length);
  const newUrl = `${origin}${novoUsername.trim().toLowerCase()}`;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        if (!confirmadoRef.current) {
          event.preventDefault();
          if (formRef.current?.reportValidity()) setConfirmando(true);
        } else {
          confirmadoRef.current = false;
        }
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="new_username" className="ui-label">Novo endereço público</label>
        <div className="flex min-w-0 items-stretch">
          <span
            aria-hidden="true"
            className="flex min-h-11 max-w-[65%] items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 text-sm text-muted-foreground"
          >
            <span className="truncate">{origin}</span>
          </span>
          <input
            id="new_username"
            name="new_username"
            required
            minLength={3}
            maxLength={32}
            pattern="[a-z0-9](-?[a-z0-9])*"
            title="Digite somente o nome após a barra: letras minúsculas, números e hífen."
            aria-describedby="new-username-help"
            autoComplete="off"
            value={novoUsername}
            onChange={(event) => setNovoUsername(event.target.value.toLowerCase())}
            className="ui-input min-w-0 rounded-l-none"
          />
        </div>
        <p id="new-username-help" className="ui-hint">
          Digite somente o trecho depois de “/”. O domínio do sistema é fixo.
        </p>
      </div>
      <dl className="grid gap-2 text-sm">
        <div><dt className="text-muted-foreground">URL atual</dt><dd className="break-all font-medium">{currentUrl}</dd></div>
        <div><dt className="text-muted-foreground">Nova URL</dt><dd className="break-all font-medium">{novoUsername ? newUrl : "—"}</dd></div>
      </dl>
      <p className="ui-hint">A URL atual continuará funcionando como alias permanente e nunca poderá ser usada por outro cliente.</p>
      <button type="submit" disabled={pending} className="ui-btn ui-btn-outline w-fit">
        {pending ? "Alterando…" : "Alterar URL pública"}
      </button>
      <Mensagem estado={estado} />
      <ConfirmDialog
        open={confirmando}
        title="Confirmar alteração da URL pública?"
        description={`URL atual: ${currentUrl}. Nova URL: ${newUrl}. O endereço antigo continuará abrindo este cartão permanentemente.`}
        confirmLabel="Sim, alterar URL"
        onCancel={() => setConfirmando(false)}
        onConfirm={() => {
          confirmadoRef.current = true;
          setConfirmando(false);
          formRef.current?.requestSubmit();
        }}
      />
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
