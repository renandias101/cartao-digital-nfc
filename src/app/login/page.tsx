"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";
import { DURACAO_LEGENDA, useTransientMessage } from "@/components/use-transient-message";
import styles from "./login.module.css";

const initialState: LoginState = { error: null };
const rememberedUsernameKey = "cartao-digital:remembered-username:v1";

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

const userShape = <><circle cx="12" cy="7" r="3.5" /><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" /></>;

/** Login único; a arte de referência é apresentada apenas no painel promocional. */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const erro = useTransientMessage(state.error ? state : null, DURACAO_LEGENDA.erro)?.error;
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);
  const rememberRef = useRef<HTMLInputElement>(null);
  const recoveryWrapRef = useRef<HTMLDivElement>(null);
  const recoveryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const remembered = localStorage.getItem(rememberedUsernameKey);
      if (remembered && remembered.length <= 64 && usernameRef.current && rememberRef.current) {
        usernameRef.current.value = remembered;
        rememberRef.current.checked = true;
      }
    } catch {
      // Armazenamento bloqueado pelo navegador não impede o login.
    }
  }, []);

  useEffect(() => {
    if (!showRecovery) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowRecovery(false);
        recoveryButtonRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!recoveryWrapRef.current?.contains(event.target as Node)) {
        setShowRecovery(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showRecovery]);

  function saveRememberedUsername() {
    try {
      if (rememberRef.current?.checked && usernameRef.current?.value) {
        localStorage.setItem(rememberedUsernameKey, usernameRef.current.value);
      } else {
        localStorage.removeItem(rememberedUsernameKey);
      }
      setStorageNotice("");
    } catch {
      setStorageNotice("Seu navegador não permitiu lembrar o usuário. Você ainda pode entrar normalmente.");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.artwork} aria-label="Apresentação do cartão de visita digital">
        <div className={styles.artworkImage}>
          <Image src="/images/login-reference-renan.webp" alt="" fill sizes="100vw" />
        </div>
        <div className={styles.accessibleCopy}>
          <h2>Cartão de Visita Digital — Todos os seus contatos em um único link.</h2>
          <p>Compartilhe seus contatos, redes sociais e serviços em um só lugar.</p>
          <ul><li>Compartilhamento fácil</li><li>Personalização</li><li>Um único link</li></ul>
          <p>Ilustração de um cartão digital em um celular.</p>
        </div>
      </section>

      <section className={styles.formArea} aria-labelledby="login-title">
        <div className={styles.card}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}><Icon>{userShape}</Icon></span>
            <p>Cartão de Visita Digital</p>
          </div>

          <header className={styles.welcome}>
            <h1 id="login-title">Bem-vindo(a)</h1>
            <p>Acesse sua conta para gerenciar seu cartão de visita digital.</p>
          </header>

          <form action={formAction} onSubmit={saveRememberedUsername} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="username">Usuário</label>
              <div className={styles.inputWrap}>
                <Icon className={styles.fieldIcon}>{userShape}</Icon>
                <input ref={usernameRef} id="username" name="username" type="text"
                  autoComplete="username" autoCapitalize="none" spellCheck={false}
                  required maxLength={64} placeholder="Digite seu usuário"
                  aria-describedby={erro ? "login-error" : undefined} />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Senha</label>
              <div className={styles.inputWrap}>
                <Icon className={styles.fieldIcon}>
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
                </Icon>
                <input id="password" name="password" type={showPassword ? "text" : "password"}
                  autoComplete="current-password" required maxLength={200}
                  placeholder="Digite sua senha"
                  aria-describedby={erro ? "login-error" : undefined} />
                <button type="button" className={styles.eye}
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-controls="password">
                  <Icon>
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {!showPassword ? <path d="m3 3 18 18" /> : null}
                  </Icon>
                </button>
              </div>
            </div>

            <div className={styles.options}>
              <label className={styles.remember} title="Lembrar somente o nome de usuário neste dispositivo">
                <input ref={rememberRef} type="checkbox" onChange={saveRememberedUsername}
                  aria-describedby="remember-help" />
                <span>Lembrar de mim</span>
              </label>
              <span id="remember-help" className={styles.accessibleCopy}>
                Salva apenas o nome de usuário neste dispositivo, sem guardar a senha.
              </span>
              <div ref={recoveryWrapRef} className={styles.recoveryWrap}>
                <button ref={recoveryButtonRef} type="button" className={styles.recovery}
                  aria-haspopup="dialog" aria-controls="recovery-help" aria-expanded={showRecovery}
                  onClick={() => setShowRecovery((visible) => !visible)}>
                  Esqueceu a senha?
                </button>
                {showRecovery ? (
                  <div id="recovery-help" className={styles.recoveryPopover} role="dialog"
                    aria-labelledby="recovery-title" aria-describedby="recovery-description">
                    <div className={styles.recoveryCard}>
                      <Image src="/images/password-help.webp" alt="" fill
                        sizes="(max-width: 408px) 100vw, 390px" className={styles.recoveryArtwork} />
                      <button type="button" className={styles.recoveryClose} aria-label="Fechar aviso"
                        onClick={() => {
                          setShowRecovery(false);
                          recoveryButtonRef.current?.focus();
                        }}>
                        <Icon><path d="M5 5l14 14M19 5 5 19" /></Icon>
                      </button>
                      <div className={styles.recoveryText}>
                        <h2 id="recovery-title">Esqueceu sua senha?</h2>
                        <p id="recovery-description">Entre em contato com Renan Dias</p>
                        <a href="tel:+5596981233398">96981233398</a>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {storageNotice ? <p className={styles.notice} role="status">{storageNotice}</p> : null}
            {erro ? <p id="login-error" className={styles.error} role="alert">{erro}</p> : null}

            <button type="submit" disabled={pending} className={styles.submit}>
              {pending ? "Entrando…" : "Entrar"}
              {!pending ? <Icon><path d="M4 12h16M13 5l7 7-7 7" /></Icon> : null}
            </button>
          </form>
        </div>
      </section>

    </main>
  );
}
