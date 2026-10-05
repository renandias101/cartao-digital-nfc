import { IconAlert, IconCheck, IconClose } from "@/components/icons";
import { ROTULO_NIVEL, type ItemSaude, type NivelSaude } from "@/lib/admin/card-health";

const ESTILO_NIVEL: Record<NivelSaude, string> = {
  saudavel: "bg-success-soft text-success",
  atencao: "bg-warning-soft text-warning",
  incompleto: "bg-destructive/10 text-destructive",
};

const ICONE: Record<ItemSaude["situacao"], { Icone: typeof IconCheck; classe: string; leitor: string }> = {
  ok: { Icone: IconCheck, classe: "text-success", leitor: "OK:" },
  aviso: { Icone: IconAlert, classe: "text-warning", leitor: "Atenção:" },
  falta: { Icone: IconClose, classe: "text-destructive", leitor: "Falta:" },
};

/** Só desenha o resultado de `avaliarSaudeDoCartao` (as regras ficam lá). */
export function CardHealthPanel({ nivel, itens }: { nivel: NivelSaude; itens: ItemSaude[] }) {
  return (
    <div className="flex flex-col gap-3">
      <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${ESTILO_NIVEL[nivel]}`}>
        {ROTULO_NIVEL[nivel]}
      </span>
      <ul className="flex flex-col gap-2 text-sm">
        {itens.map((item) => {
          const { Icone, classe, leitor } = ICONE[item.situacao];
          return (
            <li key={item.chave} className="flex items-start gap-2">
              <Icone className={`mt-0.5 size-4 shrink-0 ${classe}`} />
              <span>
                <span className="sr-only">{leitor} </span>
                {item.texto}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
