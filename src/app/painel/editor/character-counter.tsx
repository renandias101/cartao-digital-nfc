import { contarCaracteres } from "@/lib/constants";

/**
 * "N/limite" contado como o banco conta (emoji = 1). Fica vermelho acima do
 * limite: o campo não trava a digitação, quem recusa o excesso é o salvar.
 */
export function ContadorCaracteres({
  id,
  texto,
  limite,
  className = "block text-right text-xs tabular-nums",
}: {
  id: string;
  texto: string;
  limite: number;
  className?: string;
}) {
  const usados = contarCaracteres(texto);
  const excedeu = usados > limite;
  return (
    <span id={id} className={`${className} ${excedeu ? "font-medium text-destructive" : "text-muted-foreground"}`}>
      {usados}/{limite}
      <span className="sr-only">
        {excedeu ? ` caracteres — ${usados - limite} acima do limite` : " caracteres usados"}
      </span>
    </span>
  );
}
