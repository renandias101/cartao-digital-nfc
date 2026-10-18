# Pendências antes da reativação em produção

Atualizado em: 18/10/2026. Auditoria atual: [AUDITORIA-2026-10-18.md](AUDITORIA-2026-10-18.md).

## Estado atual

- [x] Produção reativada por ordem do responsável em 18/10/2026; continua na versão `cbb5dfa`, anterior às correções da branch de segurança.
- [x] Corrigir localmente o cache público do otimizador de imagens privadas (A01 da auditoria).
- [ ] Testar no Preview a revogação de imagens após troca e cancelamento.
- [x] Desabilitar cadastro público no Supabase remoto (A02, concluído em 18/10/2026).
- [x] Alinhar política remota de senhas e URL do Auth de forma granular (A08, concluído em 18/10/2026).

## Segurança e publicação

- [x] Confirmado cadastro e verificação TOTP diretamente no Supabase em 18/10/2026.
- [x] TOTP cadastrado para o administrador `renandias101` e sessão `aal2` confirmada no painel.
- [x] Documentar o procedimento de recuperação administrativa em `docs/RECUPERACAO-ADMIN-MFA.md`.
- [ ] Guardar uma cópia protegida do procedimento fora do repositório e testar o acesso do responsável ao painel Supabase.
- [x] Commit criado na branch `preview/security-mfa-20261012` e enviado ao GitHub (`0bd5717`), sem alterar a `main`.
- [x] Preview criado em 18/10/2026: `cartao-digital-2ibpfn6ga-bzl-tech.vercel.app`, estado READY.
- [ ] Configurar Preview com Supabase isolado e dados sintéticos; as variáveis atuais existem somente em Production. Compartilhamento da chave secreta foi bloqueado pela revisão automática e não ocorreu.
- [ ] Executar login/MFA/health/imagens no Preview funcional. READY não significa integração validada.
- [x] Instalado cliente PostgreSQL 17.11 e copiados 10 arquivos do Storage para `backups/card-images-2026-10-18` (548.610 bytes); manifesto validado com tamanho e SHA-256 dos 10 objetos.
- [x] Gerado backup lógico do banco/Auth em `backups/database-2026-10-18/database.dump` (449.966 bytes), acompanhado de `roles.sql`, catálogo e hashes SHA-256. O catálogo confirma `auth.users`, `public.clients` e `storage.objects`.
- [x] Restaurados isoladamente os dados da aplicação em PGlite: 1 administrador, 1 cliente, 1 rascunho, 1 cartão publicado e 1 pedido de redefinição. O catálogo do Auth foi validado como legível; o runtime completo do Supabase Auth não foi restaurado localmente.
- [ ] Se for exigida prova integral de desastre, restaurar o dump em outro projeto Supabase ou concluir WSL/Docker. O teste atual prova a aplicação e a legibilidade do Auth, mas não o funcionamento do provedor Auth restaurado.
- [ ] Guardar uma segunda cópia criptografada do backup completo fora deste computador. A pasta `backups/` permanece ignorada pelo Git.
- [ ] Aplicar `supabase/migrations/20261012150000_admin_mfa_aal2.sql` somente depois de o fluxo TOTP estar publicado e validado.
- [ ] Validar que falhas de MFA não bloqueiam o único administrador.
- [ ] Promover a versão validada para produção somente com autorização.

## Operação externa

- [ ] Configurar um monitor HTTPS para `/api/health`, a cada cinco minutos, alertando após duas falhas consecutivas.
- [ ] Solicitar revisão do alerta de possível phishing no Google Search Console depois da publicação e dos testes.
- [x] Reativação autorizada e executada em 18/10/2026.
- [x] Corrigir localmente retenção, hashes e concorrência dos pedidos de recuperação (A07).
- [ ] Aplicar `20261018150000_password_reset_concurrency_and_retention.sql` e confirmar o job `purge-password-reset-attempts-hourly` no Supabase Cron.
- [x] Corrigir localmente cadastro MFA interrompido, tentativa repetida, falhas e saída segura.
- [ ] Testar concorrência e cadastro MFA interrompido com integração real do Supabase.

## Validações locais concluídas em 18/10/2026

- [x] `npm run typecheck`.
- [x] `npm run lint`.
- [x] `npm run test:editor`: 25/25.
- [x] `npm run test:admin`: 11/11.
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
- A autorização anterior para publicação/migration permanece condicionada aos pré-requisitos técnicos. Esta auditoria não aplicou alterações remotas.
