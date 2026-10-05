import Link from "next/link";
import { redirect } from "next/navigation";

import { CardStateBadge } from "@/app/admin/card-state-badge";
import { IconAlert, IconExternal, IconSearch, IconUserPlus } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { contarAtencao, listarClientes, type ClienteOperacional, type ContagensDeAtencao } from "@/lib/admin/clients";
import { FILTROS_ADICIONAIS, FILTROS_PRINCIPAIS, lerFiltro, rotuloDoFiltro, type FiltroAdmin } from "@/lib/admin/filters";
import { getActor } from "@/lib/auth/session";
import { urlPublicaDoCartao } from "@/lib/env";
import { dias, formatarData } from "@/lib/format";

const NOMES_STATUS: Record<string, string> = { active: "Ativo", expired: "Vencido", cancelled: "Cancelado" };

/** Vencimento com a distância em dias, para todos os status. */
function vencimento(c: ClienteOperacional): { data: string; detalhe: string } {
  const data = formatarData(c.expires_at);
  if (c.status === "cancelled") {
    return { data, detalhe: c.cancelled_on ? `cancelado em ${formatarData(c.cancelled_on)}` : "cancelado" };
  }
  const n = c.days_until_expiry;
  if (c.status === "expired") return { data, detalhe: `vencido há ${dias(Math.abs(n))}` };
  return { data, detalhe: n <= 0 ? "vence hoje" : `em ${dias(n)}` };
}

/** "O que precisa da minha atenção hoje?" — só aparece o que tem pendência. */
function itensDeAtencao(c: ContagensDeAtencao) {
  return [
    { n: c.vence_em_15_dias, texto: (n: number) => `${n === 1 ? "cliente vence" : "clientes vencem"} nos próximos 15 dias`, href: "/admin?filtro=vence_em_15_dias" },
    { n: c.vencidos, texto: (n: number) => (n === 1 ? "cliente está vencido" : "clientes estão vencidos"), href: "/admin?filtro=vencidos" },
    { n: c.alteracoes_nao_publicadas, texto: (n: number) => (n === 1 ? "cartão tem alterações não publicadas" : "cartões têm alterações não publicadas"), href: "/admin?filtro=alteracoes_nao_publicadas" },
    { n: c.nunca_publicados, texto: (n: number) => (n === 1 ? "cliente nunca publicou o cartão" : "clientes nunca publicaram o cartão"), href: "/admin?filtro=nunca_publicados" },
    { n: c.suporte_aberto, texto: (n: number) => (n === 1 ? "pedido de suporte aguarda resposta" : "pedidos de suporte aguardam resposta"), href: "/admin/suporte" },
    { n: c.elegiveis_exclusao, texto: (n: number) => (n === 1 ? "cliente está elegível para exclusão" : "clientes estão elegíveis para exclusão"), href: "/admin?filtro=elegiveis_exclusao" },
  ].filter((item) => item.n > 0);
}

function contagemDoFiltro(filtro: FiltroAdmin, c: ContagensDeAtencao | null): number | null {
  if (!c) return null;
  const mapa: Partial<Record<FiltroAdmin, number>> = {
    ativos: c.ativos,
    vence_em_15_dias: c.vence_em_15_dias,
    vencidos: c.vencidos,
    cancelados: c.cancelados,
  };
  return mapa[filtro] ?? null;
}

function montarQuery(base: Record<string, string>, sobrescrever: Record<string, string>) {
  const params = new URLSearchParams({ ...base, ...sobrescrever });
  for (const [chave, valor] of Object.entries(sobrescrever)) if (!valor) params.delete(chave);
  return params.toString();
}

/**
 * Painel administrativo: o que pede atenção hoje e a lista de clientes com
 * filtros, busca e paginação (PRD §35-§38). Tudo por link e formulário GET —
 * a URL guarda o estado, sem componente de cliente.
 */
export default async function AdminPage(props: PageProps<"/admin">) {
  const actor = await getActor();
  if (!actor.logado) redirect("/login");
  if (!actor.isAdmin) redirect("/painel");

  const sp = await props.searchParams;
  const filtro = lerFiltro(sp.filtro);
  const busca = typeof sp.busca === "string" ? sp.busca : "";
  const pagina = Number(sp.pagina) || 1;
  const excluido = typeof sp.excluido === "string" ? sp.excluido : null;

  const [{ clientes, total, totalPaginas }, contagens] = await Promise.all([
    listarClientes({ filtro, busca, pagina }),
    contarAtencao(),
  ]);
  const atencao = contagens ? itensDeAtencao(contagens) : [];
  const baseQuery = { filtro, busca, pagina: String(pagina) };
  const filtroAdicionalAtivo = FILTROS_ADICIONAIS.some((f) => f.valor === filtro);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Painel administrativo</h1>
        <Link href="/admin/clientes/novo" className="ui-btn ui-btn-primary">
          <IconUserPlus />
          Novo cliente
        </Link>
      </header>

      {excluido ? (
        <p role="status" className="ui-card p-4 text-sm">
          Cliente @{excluido} excluído.
          {sp.conta === "pendente"
            ? " A conta de login não pôde ser removida: remova-a no painel do Supabase (Authentication)."
            : ""}
        </p>
      ) : null}

      <section aria-labelledby="titulo-atencao" className="ui-card flex flex-col gap-3 p-4 sm:p-5">
        <h2 id="titulo-atencao" className="flex items-center gap-2 text-base font-semibold">
          <IconAlert className="size-5 text-gold" />
          Precisam de atenção
        </h2>
        {contagens === null ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar os indicadores.</p>
        ) : atencao.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada pendente hoje.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {atencao.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted">
                  <span className="min-w-8 text-lg font-semibold tabular-nums">{item.n}</span>
                  <span>{item.texto(item.n)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="ui-card flex flex-col gap-4 p-4 sm:p-5">
        <nav aria-label="Filtrar clientes" className="flex flex-wrap gap-2 text-sm">
          {FILTROS_PRINCIPAIS.map((f) => {
            const ativo = filtro === f.valor;
            const n = contagemDoFiltro(f.valor, contagens);
            return (
              <Link
                key={f.valor}
                href={`/admin?${montarQuery(baseQuery, { filtro: f.valor, pagina: "1" })}`}
                aria-current={ativo ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 font-medium transition-colors ${
                  ativo
                    ? "border-sidebar bg-sidebar text-sidebar-foreground"
                    : "border-input bg-card text-zinc-600 hover:bg-muted hover:text-foreground"
                }`}
              >
                {f.rotulo}
                {n !== null ? <span className="tabular-nums opacity-70">{n}</span> : null}
              </Link>
            );
          })}
        </nav>

        <details open={filtroAdicionalAtivo} className="text-sm">
          <summary className="w-fit cursor-pointer font-medium text-zinc-600 hover:text-foreground">
            Mais filtros{filtroAdicionalAtivo ? `: ${rotuloDoFiltro(filtro)}` : ""}
          </summary>
          <nav aria-label="Filtros adicionais" className="mt-3 flex flex-wrap gap-2">
            {FILTROS_ADICIONAIS.map((f) => {
              const ativo = filtro === f.valor;
              return (
                <Link
                  key={f.valor}
                  href={`/admin?${montarQuery(baseQuery, { filtro: f.valor, pagina: "1" })}`}
                  aria-current={ativo ? "page" : undefined}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3.5 font-medium transition-colors ${
                    ativo
                      ? "border-sidebar bg-sidebar text-sidebar-foreground"
                      : "border-input bg-card text-zinc-600 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.rotulo}
                </Link>
              );
            })}
          </nav>
        </details>

        <form action="/admin" method="get" role="search" className="flex gap-2">
          <input type="hidden" name="filtro" value={filtro} />
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="busca"
              defaultValue={busca}
              placeholder="Buscar por nome, usuário, WhatsApp ou e-mail…"
              aria-label="Buscar por nome, usuário, WhatsApp ou e-mail"
              className="ui-input pl-9"
            />
          </div>
          <button type="submit" className="ui-btn ui-btn-outline">
            Buscar
          </button>
        </form>
      </div>

      {clientes.length === 0 ? (
        <p className="ui-card p-8 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Clientes — {rotuloDoFiltro(filtro)}</caption>
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-xs font-medium tracking-wide text-zinc-600 uppercase">
                  <th scope="col" className="px-5 py-3">Cliente</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Vencimento</th>
                  <th scope="col" className="px-5 py-3">Cartão</th>
                  <th scope="col" className="px-5 py-3">Suporte</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">Abrir cartão</span></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => {
                  const venc = vencimento(c);
                  return (
                    <tr key={c.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/50">
                      <td className="px-5 py-3.5">
                        <Link href={`/admin/clientes/${c.username}`} className="font-medium hover:text-primary hover:underline">
                          {c.full_name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">@{c.username}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={c.status} label={NOMES_STATUS[c.status] ?? c.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        {venc.data}
                        <span className="block text-xs text-muted-foreground">{venc.detalhe}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <CardStateBadge estado={c.card_state} />
                        {c.published_at ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">publicado em {formatarData(c.published_at)}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        {c.open_support_count > 0 ? (
                          <Link href="/admin/suporte" className="font-medium text-gold hover:underline">
                            {c.open_support_count} {c.open_support_count === 1 ? "aberto" : "abertos"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <a
                          href={urlPublicaDoCartao(c.username)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir o cartão de ${c.full_name} em nova aba`}
                          title="Abrir cartão"
                          className="ui-btn ui-btn-ghost ui-btn-icon"
                        >
                          <IconExternal />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPaginas > 1 ? (
        <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-zinc-600">
            {total} cliente(s) — página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 ? (
              <Link href={`/admin?${montarQuery(baseQuery, { pagina: String(pagina - 1) })}`} className="ui-btn ui-btn-outline ui-btn-sm">
                Anterior
              </Link>
            ) : null}
            {pagina < totalPaginas ? (
              <Link href={`/admin?${montarQuery(baseQuery, { pagina: String(pagina + 1) })}`} className="ui-btn ui-btn-outline ui-btn-sm">
                Próxima
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
