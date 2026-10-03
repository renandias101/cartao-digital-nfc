import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cartão Digital",
  description: "Plataforma de cartões de visita digitais com NFC.",
};

// Prioridade mobile-first definida no PRD (§51). `maximumScale` fica livre
// de propósito: travar zoom prejudica acessibilidade.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
