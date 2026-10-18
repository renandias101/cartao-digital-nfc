# Auditoria de código, implantação e pendências — 18/10/2026

## Escopo e método

Framework de Desenvolvimento de Software, fluxo Auditoria do Sistema, regras do AGENTS.md e decisões D74–D79. Não há PRD vigente. Revisão da branch `preview/security-mfa-20261012` no commit `a0d11bd`, comparação com produção e consultas remotas somente de leitura. Nenhuma correção funcional, migration, instalação, publicação, commit ou push realizado nesta auditoria.

Foram utilizados `database-testing` e `supabase-postgres-best-practices`. O catálogo do framework referencia Trail of Bits, mas não há skill especializada correspondente instalada no diretório atual. A exposição pública, autenticação, dados pessoais e uso de chave que ignora RLS justificam revisão especializada complementar. Não foi feito pentest, DAST/SAST especializado, exploração externa ou certificação LGPD. A revisão de privacidade é técnica, sem parecer jurídico.

ASVS estável confirmado na fonte oficial em 18/10/2026: 5.0.0, https://owasp.org/projects/asvs. Utilizado como referência temática de autenticação, sessão, autorização e proteção de dados; não foi executada uma matriz integral nem se declara conformidade com nível ASVS.

## Resultado

Os testes locais passam, mas isso não equivale à segurança da produção: a versão de produção continua anterior às correções da branch, o MFA não é obrigatório no banco remoto e o Preview não tem variáveis de ambiente. Há achados novos na integração de imagens e na retenção dos eventos de recuperação.

## Achados prioritários

### A01 — Alto — otimizador de imagens contraria revogação imediata

**Mitigado localmente em 18/10/2026; validação hospedada pendente.** Banner e foto agora usam `unoptimized`, e `/api/card-image` foi removida de `images.localPatterns`, impedindo o uso da rota pelo otimizador. O teste de regressão, TypeScript, lint e build passaram. Ainda falta comprovar no Preview a revogação depois de publicação, troca e cancelamento.

**Confirmado por inspeção estática; exploração ponta a ponta não executada.** `src/components/digital-card.tsx:49` e `:53` usam `next/image` sem `unoptimized` para banner/foto privados. `src/app/api/card-image/route.ts` verifica acesso e responde `private, no-store`, porém o otimizador instalado usa `Math.max(minimumCacheTTL, getMaxAge(...))` (`node_modules/next/dist/server/image-optimizer.js:1307`) e responde cache público (`:1433`). O padrão instalado é 14.400 segundos (`node_modules/next/dist/shared/lib/image-config.js:57`).

Impacto: uma imagem antes permitida pode continuar acessível pela URL otimizada após cancelamento ou troca da publicação, sem reavaliar a autorização na origem. A duração real na Vercel não foi medida. Também é necessário validar isolamento do rascunho quando o otimizador recebe cookies. Não há evidência nesta auditoria de vazamento ocorrido.

Recomendação: servir essas imagens já convertidas para WebP diretamente pela rota autorizada, desabilitar a otimização para imagens privadas e impedir que `/_next/image` aceite essa rota. Validar imagem de rascunho anônima, acesso do dono e do admin, publicação, troca e cancelamento, incluindo uma URL otimizada anteriormente aquecida. Reduzir TTL sozinho não atende revogação imediata.

### A02 — Alto — cadastro público remoto habilitado

**Resolvido no Supabase remoto em 18/10/2026.** `auth.enable_signup` foi alterado para `false` no projeto `eabefggjiybpvucpvcxv`. A comparação posterior confirmou ausência de divergência nesse campo; as demais propriedades remotas não declaradas foram preservadas.

**Confirmado por consulta remota:** `supabase config diff` mostra `auth.enable_signup`: remoto `true`, local `false`. Contraria a criação de clientes exclusivamente pela administração, documentada em `docs/OPERACAO-PRODUCAO.md`. Pode permitir contas Auth sem cadastro administrativo; isso não demonstra obtenção de privilégios ou quebra de RLS.

Recomendação: desabilitar cadastro público no projeto correto, mantendo a criação via Admin API. Revisar somente contagens/metadados necessários de contas sem vínculo e investigar antes de qualquer exclusão.

### A03 — Alto — MFA ainda não exigido no banco remoto

**Confirmado por consulta remota:** `supabase migration list` mostra apenas `20261012150000` sem versão remota. As anteriores estão reconciliadas. TOTP habilitado no provedor não significa exigência de segundo fator. A função de autorização anterior não exige `aal2`.

Recomendação: concluir backup e recuperação, validar cadastro/desafio em ambiente isolado, coordenar publicação com a migration e confirmar que operações administrativas em `aal1` são negadas. Não aplicar a migration isoladamente na produção antiga.

### A04 — Alto — correções da branch não chegaram à produção

**Confirmado por consulta da Vercel:** produção permanece no commit `cbb5dfa`; Preview no `a0d11bd`. Privacidade, MFA, health check e cabeçalhos novos existentes na branch não devem ser considerados controles publicados em produção. A reativação do projeto ocorreu na etapa anterior, sem promoção dessa branch.

Recomendação: validar e promover somente depois das dependências de backup, configuração e MFA. O alerta Google atual não foi consultado no Search Console; permanece pendência, não novo diagnóstico de phishing.

### A05 — Médio — Preview sem variáveis e sem isolamento comprovado

**Confirmado por consulta:** `vercel env ls` lista as cinco variáveis apenas em Production. A execução hospedada anterior registrou login 500 e health indisponível; esses HTTPs não foram repetidos nesta auditoria. O build passa porque as variáveis são verificadas apenas quando utilizadas (`src/lib/env.ts`).

A cópia de segredos para Preview foi bloqueada anteriormente pela revisão automática e continua sem autorização específica. Não foi repetida. Mesmo autorizada, copiar a chave secreta de produção daria ao Preview acesso que ignora RLS sobre dados reais, contrariando a separação indicada na documentação.

Recomendação: Supabase separado de homologação, massa sintética e variáveis exclusivas de Preview. Adicionar validação de configuração por ambiente antes do deployment.

### A06 — Alto operacional — recuperação de dados incompleta

**Mitigado localmente em 18/10/2026:** a cópia de Storage contém 10 objetos e 548.610 bytes, com tamanho e SHA-256 validados por objeto. O dump lógico `database.dump` contém 449.966 bytes, tem hash SHA-256 confirmado e catálogo legível com `auth.users`, `public.clients` e `storage.objects`; `roles.sql` foi exportado sem senhas de funções globais. A restauração isolada da camada da aplicação em PGlite recuperou 1 administrador, 1 cliente, 1 rascunho, 1 cartão publicado e 1 pedido de redefinição. Os arquivos temporários em SQL aberto foram removidos.

**Limite residual:** o runtime completo do Supabase Auth não foi restaurado, pois isso exige outro projeto Supabase ou um ambiente local completo. O teste prova a legibilidade do catálogo do Auth e a restauração dos dados da aplicação, mas não autenticação contra um provedor restaurado. Falta também uma segunda cópia criptografada fora deste computador.

Recomendação: guardar uma segunda cópia criptografada e, antes de considerar recuperação integral comprovada, restaurar o conjunto em outro projeto Supabase. Não registrar dumps com dados reais no Git.

### A07 — Médio — retenção prometida de 24h não é garantida

**Mitigado localmente em 18/10/2026; aplicação remota pendente.** A migration `20261018150000_password_reset_concurrency_and_retention.sql` substitui o username em texto por hash nos eventos, cria expurgo horário com Supabase Cron e serializa as quotas por usuário e origem. Também reserva cada pedido antes da chamada ao Auth, impedindo dois atendimentos simultâneos. A política passou a descrever a rotina horária com fidelidade. A suíte de banco passou com 349/349 testes; a execução do agendamento precisa ser confirmada no Supabase depois da migration.

**Confirmado por inspeção:** `/privacidade` afirma até 24 horas para tentativas de recuperação. A migration `20261012120000_password_reset_requests.sql:75` apaga eventos antigos somente quando um novo pedido chega. Sem tráfego, permanecem por mais de 24h. Além disso, `private.password_reset_attempts.username` recebe o nome normalizado em texto; a decisão D78 afirma incorretamente que também é hash.

Recomendação: rotina periódica de expurgo ou descrição fiel da retenção; alinhar decisão técnica, implementação e política. Revisar também retenção de suporte, auditoria, pagamentos e cópias locais. Não se trata de parecer jurídico.

### A08 — Médio — política remota de senha/sessão diverge do previsto

**Resolvido no Supabase remoto em 18/10/2026.** Foram alterados de forma granular `auth.minimum_password_length` para 8, `auth.email.secure_password_change` para `true` e `auth.site_url` para `https://cartao-de-visita-digital-nfc.vercel.app`. A comparação posterior confirmou zero atualizações pendentes nesses campos; e-mail, SMS, MFA, banco e Storage permaneceram inalterados.

**Confirmado por consulta:** `auth.minimum_password_length` remoto é 6, local é 8; `auth.email.secure_password_change` remoto é false e local true; `site_url` remoto é localhost. A aplicação valida oito caracteres e reautentica na troca, mas o provedor permanece menos restritivo para acesso direto à API.

Recomendação: revisar e ajustar esses campos individualmente, com teste de troca pelo cliente. Não executar `supabase config push` amplo: há diferenças de e-mail, SMS, pool e Storage que não devem ser sobrescritas indiscriminadamente.

### A09 — Médio — cinco alertas npm na mesma cadeia de desenvolvimento

**Confirmado por ferramenta:** `npm audit` aponta cinco pacotes altos relacionados ao único aviso `GHSA-vfj7-8cjw-p6xm`, na cadeia do lint. `npm audit --omit=dev` não aponta vulnerabilidades. Não são cinco ataques independentes, nem foi demonstrada exploração pela aplicação pública.

Recomendação: avaliar atualização/override compatível em branch com lint e build. A sugestão automática troca `eslint-config-next` para 14.2.35; isso não significa que seja necessário rebaixar todo o Next.js. Não aplicar downgrade indiscriminado.

## Suspeitas e lacunas que exigem teste

- MFA: **mitigado localmente em 18/10/2026.** A tela reaproveita fator verificado, remove somente cadastros TOTP incompletos antes de gerar outro, deduplica a preparação, trata falhas inesperadas e oferece reinício/saída. A classificação e os controles possuem testes locais; cadastro, interrupção e novo desafio ainda precisam ser reproduzidos com o provedor real.
- Concorrência: limite de recuperação usa contagem seguida de inserção, sem serializar por usuário/origem; pedidos paralelos podem ultrapassar o limite. Índice único protege a fila pendente, não a quota. Teste concorrente ainda não executado.
- Atendimento: alteração de senha no Auth e conclusão do pedido não são uma transação única. A falha na conclusão é tratada, mas dois administradores atendendo/encerrando simultaneamente podem gerar resultados inconsistentes. Falta teste concorrente e mecanismo de reserva/idempotência.
- Proxy: redirecionamentos criam nova resposta sem copiar os cookies de refresh acumulados em `response`; verificar expiração durante login/redirecionamento antes de classificar como defeito reproduzido.
- Google, monitor externo, autenticação `aal2` real, recuperação do único administrador e acessibilidade com axe/leitor de tela: não verificados nesta rodada.

O procedimento de recuperação do único administrador foi documentado em `docs/RECUPERACAO-ADMIN-MFA.md`; sua execução real continua pendente para não remover fatores sem necessidade.

## Cobertura de requisitos e evidências

| Requisito/fonte | Cadeia verificada | Resultado e ambiente | Estado/pendência |
|---|---|---|---|
| Aliases permanentes, AGENTS/D74 | função administrativa → aliases → resolução pública | suíte RLS com nomes sucessivos e exclusão | Validado local; smoke hospedado pendente |
| Somente publicado/ativo, AGENTS/D77 | página → RPC → publicação/status | suíte RLS nega inativo/rascunho | Validado SQL; imagens via otimizador parciais, A01 |
| Isolamento, AGENTS | sessão → RLS/funções → tabelas | 344 testes totais de banco | Validado em PGlite/shim; não teste integral do Supabase Auth |
| Modelos sem dados pessoais, D76 | cadastro → duplicação → conteúdo | testes de duplicação/validação | Validado local; smoke hospedado pendente |
| Esqueci a senha, D78 | formulário → limite/RPC → fila → Auth → conclusão | testes administrativos e SQL | Parcial: concorrência/retensão e Auth real pendentes |
| MFA, pedido do responsável | login → /mfa → Auth → autorização SQL | código e teste SQL aal1/aal2 | Parcial: migration remota ausente, A03 |
| Privacidade/headers/health | páginas/rota/configuração → deploy | build local; versões Vercel diferentes | Parcial: produção antiga, A04 |
| Backup e recuperação | banco + Storage → cópia → restauração | cópia local de Storage apenas | Parcial: A06 |

## Testes executados nesta rodada

- TypeScript e lint: aprovados.
- Editor: 25/25; administração: 8/8.
- Banco/RLS: 344/344 após repetir fora do sandbox (primeira execução bloqueada por EPERM). Migrations reais aplicadas em PGlite/Postgres 18 com shim de Auth/Storage, enquanto remoto é Postgres 17: não substitui integração real.
- Navegador com mocks: aprovado em 1440×900, 390×844 e 320×740. Não cobre login/TOTP reais nem o otimizador de imagens de produção.
- Build: aprovado, 17 páginas estáticas geradas, incluindo saídas dinâmicas descritas no log. Não são 17 rotas totais.
- Dependências: produção zero avisos; conjunto completo cinco altos da cadeia de desenvolvimento.
- Consultas remotas: migrations, diferença de configuração Supabase, nomes/ambientes das variáveis e deployments Vercel. Sem mudança remota e sem coleta de senhas, QR Codes ou tokens no relatório.

## Melhorias propostas e ordem

1. Corrigir A01 com teste de revogação e rota otimizada, desabilitar cadastro público e preparar homologação isolada.
2. Concluir backup/restauração e recuperação do administrador; testar MFA interrompido e repetir desafio.
3. Ajustar Preview, executar integração real e coordenar migration/publicação de segurança.
4. Concorrência de limite/atendimento, retenção fiel e monitor de saúde.
5. CI para tipos/lint/testes/build e validação de configuração; hoje não existe `.github` com pipeline neste checkout.
6. Gerar tipos do Supabase para reduzir contratos manuais, restringir CSP com nonce/hash quando compatível e avaliar otimização de custo de imagens após preservar autorização.

Não há evidência suficiente para remover arquivos ou funcionalidades. Telefone legado foi preservado por compatibilidade documentada. `list_clients_for_admin` consta historicamente como candidato de limpeza; consumidores remotos não foram verificados, portanto preservar. Scripts em `backups` são auxiliares locais ignorados; não versionar dados reais.
