/**
 * Página 404 geral (PRD §49): mensagem simples, sem detalhe técnico.
 *
 * O 404 específico de cartão inexistente é tratado na rota pública do cartão,
 * na etapa 9, com o texto do PRD e sem revelar se a conta existe.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi alterado.
        </p>
      </div>
    </main>
  );
}
