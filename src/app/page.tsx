/**
 * Raiz do site.
 *
 * O PRD não define o que deve existir em `/` — ele especifica apenas
 * `/{usuario}` para o cartão público e as áreas de painel. Registrado como P7
 * em docs/PERGUNTAS-ABERTAS.md. Placeholder neutro até a definição.
 */
export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Cartão Digital</p>
    </main>
  );
}
