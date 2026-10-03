"use client";

/**
 * Tratamento de erro padrão (PRD §48, Seguranca 48-51).
 *
 * O objeto de erro não é exibido: mensagem técnica, caminho de arquivo ou
 * consulta nunca chegam ao usuário. O `digest` é o identificador que o Next
 * registra no servidor, e é o único dado técnico mostrado — serve para
 * localizar o erro no log sem expor nada do sistema.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não foi possível carregar esta página. Tente novamente.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Tentar novamente
        </button>
        {error.digest ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Código: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
