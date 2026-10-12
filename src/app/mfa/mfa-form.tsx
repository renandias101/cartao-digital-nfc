"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "loading" | "enroll" | "challenge" | "error";

export function MfaForm() {
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (assurance?.currentLevel === "aal2") {
        window.location.replace("/admin");
        return;
      }
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (error) {
        setMessage("Não foi possível consultar a verificação em duas etapas. Entre novamente.");
        setMode("error");
        return;
      }
      const verified = data.totp.find((factor) => factor.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("challenge");
        return;
      }
      const enrollment = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Administração" });
      if (!active) return;
      if (enrollment.error) {
        setMessage("Não foi possível iniciar o cadastro do autenticador. Confira se TOTP está ativo no Supabase.");
        setMode("error");
        return;
      }
      setFactorId(enrollment.data.id);
      setQrCode(enrollment.data.totp.qr_code);
      setSecret(enrollment.data.totp.secret);
      setMode("enroll");
    })();
    return () => { active = false; };
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setMessage("Digite os seis números exibidos no aplicativo autenticador.");
      return;
    }
    setPending(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) {
      setMessage("Código inválido ou expirado. Aguarde o próximo código e tente novamente.");
      setPending(false);
      return;
    }
    window.location.replace("/admin");
  }

  if (mode === "loading") return <p role="status" className="text-sm text-muted-foreground">Preparando verificação…</p>;
  if (mode === "error") return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-destructive">{message}</p>;

  return (
    <div className="space-y-5">
      {mode === "enroll" ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed">Abra Google Authenticator, Microsoft Authenticator ou outro aplicativo TOTP e escaneie este código:</p>
          <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
            <Image src={qrCode} alt="QR Code para cadastrar o autenticador" width={220} height={220} unoptimized />
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
      </form>
    </div>
  );
}
