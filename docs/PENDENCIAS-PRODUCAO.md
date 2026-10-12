# Pendências antes da reativação em produção

Atualizado em: 12/10/2026

## Estado atual

- [x] Projeto `cartao-digital-nfc` pausado na Vercel. Verificação pública em 12/10/2026: HTTP 503 e `X-Vercel-Error: DEPLOYMENT_PAUSED`.
- [x] Sistema mantido fora do ar até nova autorização do responsável.

## Segurança e publicação

- [ ] Ativar TOTP no Supabase em **Authentication → Multi-Factor Authentication**, habilitando cadastro e verificação.
- [ ] Cadastrar o TOTP do administrador `renandias101` e confirmar uma sessão `aal2`.
- [ ] Guardar o procedimento/meio de recuperação administrativa em local seguro.
- [ ] Autorizar commit, push e deploy das alterações locais.
- [ ] Publicar primeiro em Preview e executar os testes hospedados.
- [ ] Fazer backup verificável do Postgres e do bucket privado `card-images` antes da migration.
- [ ] Aplicar `supabase/migrations/20261012150000_admin_mfa_aal2.sql` somente depois de o fluxo TOTP estar publicado e validado.
- [ ] Validar que falhas de MFA não bloqueiam o único administrador.
- [ ] Promover a versão validada para produção somente com autorização.

## Operação externa

- [ ] Configurar um monitor HTTPS para `/api/health`, a cada cinco minutos, alertando após duas falhas consecutivas.
- [ ] Solicitar revisão do alerta de possível phishing no Google Search Console depois da publicação e dos testes.
- [ ] Reativar o projeto na Vercel somente por ordem expressa do responsável.

## Validações locais concluídas em 12/10/2026

- [x] `npm run typecheck`.
- [x] `npm run lint`.
- [x] `npm run test:editor`: 25/25.
- [x] `npm run test:admin`: 8/8.
- [x] `npm run test:rls`: 344/344, incluindo a migration de MFA.
- [x] `npm run test:editor:browser`: desktop 1440×900 e celulares 390×844 e 320×740.
- [x] `npm run build`: 17 rotas geradas, incluindo `/mfa`, `/privacidade` e `/api/health`.
- [x] `npm audit --omit=dev`: nenhuma vulnerabilidade conhecida nas dependências de produção.
- [x] `git diff --check`: sem erro de whitespace.

## Dependências de desenvolvimento

- [ ] Acompanhar a correção de `GHSA-vfj7-8cjw-p6xm` na cadeia `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. O `npm audit` sugere trocar para `eslint-config-next@14.2.35`, versão incompatível com o Next.js 16 usado pelo projeto; não aplicar esse downgrade automaticamente.

## Restrições

- Não registrar senhas, códigos TOTP, tokens, chaves ou senha do banco neste arquivo.
- Não exigir `aal2` no banco antes de o cadastro e o desafio TOTP estarem disponíveis e testados.
- Não aplicar migrations, publicar ou reativar produção sem autorização.
