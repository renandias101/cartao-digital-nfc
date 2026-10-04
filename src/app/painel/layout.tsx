/**
 * Área do cliente sem sidebar: tudo fica em `/painel` (link, situação,
 * editor e senha). Autorização continua em cada página.
 */
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return children;
}
