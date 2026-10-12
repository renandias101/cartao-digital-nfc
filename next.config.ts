import type { NextConfig } from "next";

/**
 * Hostname do Storage do Supabase, derivado da URL do projeto — não
 * hardcoded, para continuar funcionando se o projeto mudar entre ambientes
 * (dev/produção). `next.config.ts` roda no build/no início do servidor e
 * tem acesso a `process.env` normalmente.
 */
const nextConfig: NextConfig = {
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
        ],
      },
    ];
  },
};

export default nextConfig;
