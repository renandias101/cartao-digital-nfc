# Cartão Digital com NFC

Plataforma web de cartões de visita digitais vinculados a cartões NFC. Cada
cliente tem um cartão acessível por uma URL pública fixa
(`dominio.com/{usuario}`), gravada no cartão NFC. O conteúdo é editável sem
nunca alterar a URL e sem regravar o NFC.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript estrito
- Tailwind CSS 4
- Supabase: Postgres, Auth e Storage
- Deploy previsto na Vercel

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencher os valores
npm run dev
```

Aplicação em http://localhost:3000.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Servidor de produção (exige build) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir arquivos |

## Documentação

- `docs/DECISOES-TECNICAS.md` — decisões de arquitetura e o motivo de cada uma
- `docs/PERGUNTAS-ABERTAS.md` — lacunas do PRD e conflitos pendentes
- `AGENTS.md` — regras do projeto para agentes de código

## Variáveis de ambiente

Descritas em `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` ignora RLS e só pode
ser usada no servidor — nunca em componente de cliente, nunca com prefixo
`NEXT_PUBLIC_`.

## Estado atual

Etapa 1 de 17 concluída: projeto preparado. Nenhuma regra de negócio
implementada ainda.
