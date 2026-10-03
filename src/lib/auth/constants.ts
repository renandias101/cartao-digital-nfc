/**
 * Regras de autenticação (PRD §43: limite de tentativas, proteção contra
 * força bruta).
 *
 * O Supabase Auth não bloqueia conta por tentativas — só limita por IP em
 * endpoints específicos (confirmado na documentação oficial em 29/09/2026,
 * não por suposição). Estas constantes controlam o bloqueio implementado
 * neste projeto, em `private.login_throttle`.
 */
export const LOGIN_THROTTLE = {
  /** Tentativas malsucedidas permitidas antes do bloqueio. */
  maxTentativas: 5,
  /** Duração do bloqueio, em minutos. Usada tanto na tabela quanto no `ban_duration` da API admin. */
  bloqueioMinutos: 15,
} as const;

/** Tamanho mínimo de senha (PRD §43: armazenamento seguro). */
export const SENHA_MINIMA = 8;

/**
 * Domínio do e-mail sintético usado para autenticar cliente e administrador
 * sobre o Supabase Auth, que exige e-mail (PRD §4: login só por usuário e
 * senha, sem e-mail visível). Nunca é usado para enviar mensagem alguma —
 * o Supabase Auth só precisa de um identificador único no formato de e-mail.
 */
export const DOMINIO_EMAIL_SINTETICO = "internal.cartao.local";
