import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

/**
 * Proxy (renomeado de middleware no Next 16): renova a sessão do Supabase e
 * faz redirecionamento otimista por rota.
 *
 * Dois limites deliberados, ambos vindos da documentação, não de suposição:
 *
 *  1. O guia do Next para "optimistic checks" avisa que o proxy roda em toda
 *     navegação, inclusive prefetch, e manda EVITAR consulta a banco aqui.
 *     Por isso este arquivo só olha se existe usuário logado — nunca chama
 *     `am_i_admin()` (isso é RPC, ida ao Postgres). Decidir admin vs. cliente
 *     acontece dentro de `/painel` e `/admin`, que já renderizam por request.
 *
 *  2. O `matcher` só cobre `/login`, `/painel` e `/admin`. A página pública do
 *     cartão (`/{username}`) fica de fora de propósito: é o caminho de maior
 *     tráfego do sistema (aberto por NFC, PRD §52) e não precisa de sessão
 *     nenhuma — around nela, este arquivo não roda, custo zero.
 *
 * Isto NÃO é a camada de autorização (D7): é conveniência de navegação. Cada
 * página e Server Action confere de novo, via RLS e `getActor()`.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [chave, valor] of Object.entries(headers)) {
          response.headers.set(chave, valor);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const areaProtegida = pathname.startsWith("/painel") || pathname.startsWith("/admin");
  const paginaDeLogin = pathname === "/login";

  if (areaProtegida && !user) {
    const destino = new URL("/login", request.url);
    return NextResponse.redirect(destino);
  }

  if (paginaDeLogin && user) {
    const destino = new URL("/painel", request.url);
    return NextResponse.redirect(destino);
  }

  return response;
}

export const config = {
  matcher: ["/login", "/painel/:path*", "/admin/:path*"],
};
