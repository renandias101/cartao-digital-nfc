import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // O servidor local usa HTTP. No Safari móvel, esta diretiva também
  // promoveria CSS/JS locais para HTTPS e deixaria a página sem estilos.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/**
 * Hostname do Storage do Supabase, derivado da URL do projeto — não
 * hardcoded, para continuar funcionando se o projeto mudar entre ambientes
 * (dev/produção). `next.config.ts` roda no build/no início do servidor e
 * tem acesso a `process.env` normalmente.
 */
const nextConfig: NextConfig = {
  // Imagens de cartão nunca passam pelo otimizador: /api/card-image revalida
  // a permissão em toda leitura e responde sem cache. Manter a rota fora de
  // localPatterns também impede aquecimento manual via /_next/image.
  images: {
    localPatterns: [
      { pathname: "/images/login-reference-renan.webp" },
    ],
  },

  // Permite que dispositivos da rede local acessem os recursos e endpoints
  // exclusivos do servidor de desenvolvimento pelo endereço desta máquina.
  allowedDevOrigins: ["192.168.1.67", "192.168.1.68"],


  // Cabeçalhos de segurança básicos (auditoria da etapa 15). Nenhuma tela do
  // projeto usa iframe — negar enquadramento de fora não quebra nada e evita
  // clickjacking no login/painel/admin.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          ...(isDev ? [] : [
            { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          ]),
        ],
      },
    ];
  },
};

export default nextConfig;
