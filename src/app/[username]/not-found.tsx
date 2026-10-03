/**
 * 404 específico do cartão (PRD §49): username que nunca existiu. Texto
 * exato sugerido pelo PRD, sem mensagem técnica.
 *
 * Diferente da situação "existe mas está indisponível" (vencido/cancelado,
 * PRD §24/§27) — essa é tratada dentro de `page.tsx`, com status 200 e outro
 * texto, porque ali o recurso EXISTE, só não está disponível agora.
 */
export default function CartaoNaoEncontrado() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold">Cartão não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Este cartão não foi encontrado.</p>
      </div>
    </main>
  );
}
