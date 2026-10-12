# Cartão Digital com NFC

Plataforma Next.js de cartões digitais. O NFC guarda `dominio/{usuario}`. O cliente edita o conteúdo, mas somente o administrador pode mudar o usuário; todas as URLs anteriores ficam como aliases permanentes.

Não existe PRD vigente. As fontes de requisitos são o `AGENTS.md`, `docs/DECISOES-TECNICAS.md`, os relatórios de auditoria e as decisões expressas pelo responsável do produto.

## Ambiente local

Requer Node.js `>=20.9.0` (o desenvolvimento validado usa Node 24) e npm.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

A aplicação abre em `http://localhost:3000`. Configure as variáveis descritas em `.env.example`; `SUPABASE_SECRET_KEY` é exclusiva do servidor e ignora RLS.

## Verificações

```bash
npm run typecheck
npm run lint
npm run test:editor
npm run test:admin
npm run test:rls
npm run build
```

## Ambientes e publicação

Use projetos Supabase separados para desenvolvimento, preview e produção. Cada ambiente deve ter suas próprias chaves. Na Vercel, `VERCEL_PROJECT_PRODUCTION_URL` fornece automaticamente a origem pública quando `NEXT_PUBLIC_SITE_URL` está ausente ou contém localhost; um domínio definitivo configurado em `NEXT_PUBLIC_SITE_URL` tem prioridade.

Antes da primeira publicação:

1. Faça backup do banco e do bucket `card-images`.
2. Confirme com `supabase migration list` e `supabase db push --dry-run` que o histórico do ambiente está alinhado antes de publicar.
3. Execute `node --env-file=.env.local scripts/create-storage-bucket.mjs` para confirmar o bucket privado e os limites.
4. Valide login, cartão publicado, página neutra, aliases antigos, upload e exclusão em preview.
5. Execute todas as verificações acima e confira as variáveis no painel da Vercel.

A migration `20261010160000_private_card_images.sql` converte referências antigas para `/api/card-image` e torna o bucket privado. Faça backup antes. Depois de aplicá-la, execute o script do bucket e confira uma amostra de rascunhos e publicações. Em falha, interrompa a publicação, restaure o backup do banco e a configuração anterior do bucket; não tente corrigir dados reais manualmente durante o incidente.

As migrations até `20261010160000_private_card_images.sql` foram aplicadas manualmente no projeto Supabase de produção em 12/10/2026. O histórico foi reconciliado com os arquivos locais e `supabase db push --dry-run` confirmou que o banco remoto está atualizado. O código da aplicação ainda não foi publicado; o deploy e as alterações no painel da Vercel dependem de autorização explícita.

## Documentação

- `docs/DECISOES-TECNICAS.md`: decisões de arquitetura e produto.
- `docs/OPERACAO-PRODUCAO.md`: backup, restauração, rollback e checklist hospedado.
- `AGENTS.md`: regras vigentes do projeto.
