<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cartão Digital com NFC — regras do projeto

> O bloco acima é gerado e mantido pelo `next dev`. Não edite nem remova.
> Tudo abaixo desta linha são as regras deste projeto.

## Governança

Este projeto segue o **Framework de Desenvolvimento de Software** em
`G:\Meu Drive\Trabalho\Framework-Desenvolvimento-de-Software`.
Hierarquia de decisão: instruções do usuário → Núcleo → Fluxo Novo Projeto →
Perfis → Adaptador Claude Code → skills disponíveis.

Perfis aplicáveis: Sistema-Web-Fullstack + Sistema-com-Dados-Pessoais +
Sistema-Administrativo.

Não existe PRD vigente. As fontes de verdade são estas regras, as decisões
técnicas registradas, os relatórios aprovados e as decisões expressas pelo
responsável do produto. Referências históricas a seções de PRD não provam um
requisito atual.

## Ordem de prioridade

1. Segurança 2. Simplicidade 3. Manutenção 4. Performance
5. Experiência mobile 6. Isolamento dos dados 7. Qualidade do código

## Regras invioláveis do produto

1. O NFC guarda apenas a URL. O cliente não pode alterar `username` ou a URL
   pública. O administrador pode alterá-los; cada endereço anterior vira alias
   permanente do mesmo cliente, nunca reutilizável, para preservar NFCs já
   entregues.
2. A página pública serve **somente** a versão publicada. Rascunho — imagens
   incluídas — nunca pode vazar para o visitante.
3. Isolamento garantido no backend/banco. Nunca confiar em id, slug ou
   parâmetro vindo do cliente para decidir acesso.
4. Fora do status ATIVO, a página pública mostra apenas página neutra, sem
   dados, sem imagens e **sem metadados de compartilhamento**.
5. O visitante nunca vê status interno — nem em texto, nem em código HTTP,
   nem em payload de API.
6. Limite de 10 botões e limites de texto validados no servidor.
7. Nenhuma execução de conteúdo do cliente: texto como texto puro, URLs
   restritas a http/https, sem SVG em upload.
8. Modelos e duplicação nunca carregam dado pessoal.
9. Mudanças de escopo exigem decisão explícita do responsável do produto.

## Convenções técnicas

- Next.js 16 (App Router) + TypeScript estrito. Consultar
  `node_modules/next/dist/docs/` antes de escrever rotas, cache ou server
  actions: esta versão diverge de convenções anteriores.
- Supabase: Postgres + Auth + Storage. Isolamento por RLS.
- `SUPABASE_SECRET_KEY` ignora RLS. Nunca em componente de cliente,
  nunca com prefixo `NEXT_PUBLIC_`.
- Código e identificadores em inglês; textos de interface em português.

## Processo

- Trabalho em etapas pequenas. Ao fim de cada etapa: validar, relatar e
  **parar** para autorização.
- Sem commit ou push sem pedido explícito.
- Sem dependência nova sem justificar a necessidade.
- Ações destrutivas (banco, migrations, arquivos) exigem aviso prévio.
