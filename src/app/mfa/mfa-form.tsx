"use client";

import { useEffect, useRef, useState } from "react";

import { classifyTotpFactors } from "@/lib/auth/mfa-factors";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "loading" | "enroll" | "challenge" | "error";
type Preparation =
  | { kind: "redirect" }
  | { kind: "challenge"; factorId: string }
  | { kind: "enroll"; factorId: string; qrCode: string; secret: string }
  | { kind: "error"; message: string };

async function prepareMfa(): Promise<Preparation> {
  const supabase = createSupabaseBrowserClient();
  try {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance?.currentLevel === "aal2") return { kind: "redirect" };

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    const factors = classifyTotpFactors(data.all);
    if (factors.verifiedId) return { kind: "challenge", factorId: factors.verifiedId };

    for (const unverifiedId of factors.unverifiedIds) {
      const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: unverifiedId });
      if (cleanupError) {
        return { kind: "error", message: "Não foi possível limpar um cadastro anterior incompleto. Entre novamente e tente de novo." };
      }
    }

    const enrollment = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Administração ${crypto.randomUUID().slice(0, 8)}`,
    });
    if (enrollment.error) throw enrollment.error;
    return {
      kind: "enroll",
      factorId: enrollment.data.id,
      qrCode: enrollment.data.totp.qr_code,
      secret: enrollment.data.totp.secret,
    };
  } catch {
    return { kind: "error", message: "Não foi possível preparar a verificação em duas etapas. Entre novamente e tente de novo." };
  }
}

export function MfaForm() {
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const preparationRef = useRef<Promise<Preparation> | null>(null);

  useEffect(() => {
    let active = true;
    const preparation = preparationRef.current ?? prepareMfa();
    preparationRef.current = preparation;
    void (async () => {
      const result = await preparation;
      if (!active) return;
      if (result.kind === "redirect") {
        window.location.replace("/admin");
        return;
      }
      if (result.kind === "error") {
        setMessage(result.message);
        setMode("error");
        return;
      }
      setFactorId(result.factorId);
      if (result.kind === "challenge") {
        setMode("challenge");
        return;
      }
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setMode("enroll");
    })();
    return () => { active = false; };
  }, []);

  async function signOut() {
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  async function restartEnrollment() {
    if (!factorId) return;
    setPending(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      window.location.reload();
    } catch {
      setMessage("Não foi possível reiniciar o cadastro. Saia e entre novamente.");
      setPending(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setMessage("Digite os seis números exibidos no aplicativo autenticador.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      window.location.replace("/admin");
    } catch {
      setMessage("Código inválido, expirado ou indisponível. Aguarde o próximo código e tente novamente.");
      setPending(false);
    }
  }

  if (mode === "loading") return <p role="status" className="text-sm text-muted-foreground">Preparando verificação…</p>;
  if (mode === "error") return (
    <div className="space-y-3">
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-destructive">{message}</p>
      <button type="button" onClick={() => window.location.reload()} className="ui-btn ui-btn-secondary w-full">Tentar novamente</button>
      <button type="button" onClick={signOut} className="ui-btn ui-btn-secondary w-full">Sair e voltar para a entrada</button>
    </div>
  );

  return (
    <div className="space-y-5">
      {mode === "enroll" ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed">Abra Google Authenticator, Microsoft Authenticator ou outro aplicativo TOTP e escaneie este código:</p>
          <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
            {/* O Supabase entrega o QR Code como data URL, sem necessidade do otimizador do Next. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="QR Code para cadastrar o autenticador" width={220} height={220} />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Não consigo escanear</summary>
            <p className="mt-2 break-all rounded-lg bg-muted p-3 font-mono text-xs">{secret}</p>
          </details>
        </div>
      ) : null}
      <form onSubmit={verify} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="mfa-code" className="ui-label">Código de seis dígitos</label>
          <input id="mfa-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required disabled={pending}
            className="ui-input text-center text-lg tracking-[0.35em]" />
        </div>
        {message ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-destructive">{message}</p> : null}
        <button type="submit" disabled={pending || code.length !== 6} className="ui-btn ui-btn-primary w-full">
          {pending ? "Verificando…" : mode === "enroll" ? "Cadastrar e continuar" : "Verificar e continuar"}
        </button>
        {mode === "enroll" ? (
          <button type="button" onClick={restartEnrollment} disabled={pending} className="ui-btn ui-btn-secondary w-full">
            Gerar um novo QR Code
          </button>
        ) : null}
        <button type="button" onClick={signOut} disabled={pending} className="ui-btn ui-btn-secondary w-full">
          Sair e voltar para a entrada
        </button>
      </form>
    </div>
  );
}
