import type { NextConfig } from "next";

/**
 * Hostname do Storage do Supabase, derivado da URL do projeto — não
 * hardcoded, para continuar funcionando se o projeto mudar entre ambientes
 * (dev/produção). `next.config.ts` roda no build/no início do servidor e
 * tem acesso a `process.env` normalmente.
 */
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Permite que dispositivos da rede local acessem os recursos e endpoints
  // exclusivos do servidor de desenvolvimento pelo endereço desta máquina.
  allowedDevOrigins: ["192.168.1.67"],

  experimental: {
    serverActions: {
      // 5 MB por arquivo + margem para os cabeçalhos multipart.
      bodySizeLimit: 6 * 1024 * 1024,
    },
  },

  images: {
    // Só as imagens do bucket `card-images` (PRD §10, §52: "imagens
    // otimizadas" via next/image, sem abrir para qualquer domínio externo).
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/card-images/**",
          },
        ]
      : [],
  },

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
        ],
      },
    ];
  },
};

export default nextConfig;
