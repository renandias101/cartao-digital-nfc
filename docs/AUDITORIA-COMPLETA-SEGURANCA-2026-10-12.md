# Auditoria completa de segurança, privacidade e qualidade

Data: 12/10/2026  
Escopo: código, migrations, testes locais, documentação operacional e evidências fornecidas do ambiente publicado.  
Referencial: Framework de Desenvolvimento de Software; perfis Sistema-Web-Fullstack, Sistema-com-Dados-Pessoais e Sistema-Administrativo; skills `supabase-postgres-best-practices`, `compliance-testing`, `database-testing`, `risk-based-testing` e `accessibility-testing`.

## Resultado executivo

Não foi encontrada vulnerabilidade crítica confirmada no código revisado. O isolamento por usuário e por papel está implementado no banco, as rotas sensíveis repetem a autorização no servidor, as imagens são privadas e o repositório não contém chave real rastreada. As 343 verificações de banco passaram e o `npm audit` não encontrou vulnerabilidades conhecidas nas dependências.

O sistema ainda não deve ser considerado pronto para lançamento público sem tratar os itens A1 a A4. O alerta ativo do Google pode impedir o uso normal do login, a transparência exigida para o tratamento de dados pessoais não está disponível ao usuário, faltam defesas HTTP importantes na configuração da aplicação e o teste de navegador do editor está quebrado.

## Achados confirmados

### A1 — Alto — produção sinalizada pelo Google como possível phishing

**Evidência:** o Google Search Console exibiu “Possível phishing detectado no login do usuário” para o domínio de produção. O Chrome mostrou o domínio como “Perigoso” e apresentou aviso ao digitar senha. A propriedade foi verificada, mas a revisão ainda não foi concluída.

**Impacto:** usuários podem abandonar o acesso, senhas salvas podem disparar alertas e o domínio pode perder confiança. É um bloqueio operacional de lançamento, mesmo sem prova de código malicioso no repositório.

**Ação recomendada:** revisar todo o conteúdo implantado e os logs do deploy, confirmar que somente artefatos do repositório atual estão publicados, manter identidade e finalidade claras na tela de login e então solicitar revisão no Search Console. Não tentar contornar o aviso.

### A2 — Alto — transparência e governança LGPD incompletas

**Evidência:** não existe página ou aviso de privacidade na aplicação. A própria documentação registra a pendência em `docs/PERGUNTAS-ABERTAS.md` (C1 e C4). O sistema trata nome, telefone/WhatsApp, e-mail, dados do cartão, credenciais, chamados, pagamentos e registros administrativos, mas não informa ao titular finalidades, bases aplicáveis, retenção, compartilhamentos, direitos e canal de contato. O prazo de retenção de clientes cancelados continua indefinido até exclusão manual.

**Impacto:** o titular não recebe informação suficiente sobre o tratamento; pedidos de acesso, correção, eliminação e oposição não têm procedimento documentado; exclusão e backups podem produzir respostas inconsistentes.

**Ação recomendada:** aprovar política de privacidade e matriz de retenção com o responsável pelo produto/jurídico; criar canal e procedimento de direitos do titular; documentar controladores, operadores, finalidades, bases, destinatários, prazos e tratamento de backups. Publicar o aviso antes de coletar dados em produção.

### A3 — Médio — cabeçalhos de defesa incompletos na aplicação

**Evidência:** `next.config.ts:34-36` configura somente `X-Frame-Options`, `X-Content-Type-Options` e `Referrer-Policy`. Não há política CSP, `Permissions-Policy` ou HSTS declaradas pela aplicação.

**Impacto:** reduz a defesa em profundidade contra injeção de conteúdo, carregamento de origens inesperadas, uso indevido de recursos do navegador e downgrade de transporte. A plataforma pode adicionar algum cabeçalho, mas isso não foi confirmado nesta auditoria.

**Ação recomendada:** definir uma CSP compatível com Next.js e Supabase, começando em `Content-Security-Policy-Report-Only`; restringir recursos não usados com `Permissions-Policy`; confirmar HSTS no domínio publicado antes de adicioná-lo na aplicação. Validar login, editor, imagens e páginas públicas após a mudança.

### A4 — Médio — teste de navegador do editor não executa

**Evidência:** `npm run test:editor:browser` falha no build do teste. O módulo virtual `fixture:actions` não exporta `prepararImagemAction` e `processarImagemAction`, que passaram a ser importadas pelo editor. Os testes unitários não detectam este problema de integração.

**Impacto:** a cobertura de comportamento desktop/mobile, upload, falha e retentativa não está funcionando; regressões visuais e funcionais podem chegar à produção.

**Ação recomendada:** atualizar o mock do teste com as duas ações e executar novamente o cenário completo em desktop e mobile.

### A5 — Médio — recuperação pública depende de cabeçalho de origem sem vínculo explícito ao proxy confiável

**Evidência:** `src/app/esqueci-senha/actions.ts:14-15` usa o primeiro valor de `x-forwarded-for`, com fallback para `x-real-ip`, para compor a chave do limite. O banco limita a 10 tentativas por origem/hora e 3 por usuário/hora.

**Impacto:** se a infraestrutura aceitar um cabeçalho fornecido diretamente pelo cliente, um atacante pode variar a origem e enfraquecer um dos limites. O limite por usuário permanece, mas pode ser usado para bloquear temporariamente pedidos legítimos daquele nome.

**Ação recomendada:** confirmar documentalmente quais cabeçalhos a Vercel sobrescreve e confiar somente no cabeçalho garantido pela plataforma. Considerar proteção de borda e janela progressiva sem alterar a resposta uniforme.

### A6 — Baixo — mensagens técnicas do banco/provedor podem chegar à interface

**Evidência:** `src/lib/auth/change-password.ts:66`, `src/lib/admin/card-editing.ts:48,57` e `src/lib/card/draft.ts:93,104` devolvem `error.message` ao usuário em caminhos de erro não mapeados.

**Impacto:** mensagens futuras do Supabase/Postgres podem revelar nomes internos, regras ou detalhes úteis para reconhecimento do sistema, além de gerar texto inconsistente.

**Ação recomendada:** mapear códigos conhecidos para mensagens públicas estáveis e registrar apenas código/status no servidor, sem dados pessoais ou conteúdo do cartão.

### A7 — Baixo — falha ao salvar observações pode virar erro de página

**Evidência:** `src/app/admin/clientes/[username]/actions.ts:129-136` aguarda `salvarObservacoes`, que lança exceção em validação ou falha do banco, e depois sempre retorna sucesso. Não há conversão para o estado de erro usado pelo formulário.

**Impacto:** uma observação acima do limite ou uma indisponibilidade do banco pode exibir a tela genérica de erro e prejudicar a confirmação do administrador. A transação não grava dado inválido, portanto o risco é de confiabilidade e clareza.

**Ação recomendada:** retornar um resultado tipado e mensagem genérica, preservando detalhes apenas no log seguro.

### A8 — Baixo / risco aceito — senha temporária visível na tela administrativa

**Evidência:** `src/app/admin/senhas/password-request-actions.tsx:20` usa `type="text"` no campo `new_password`, conforme decisão expressa do responsável do produto.

**Impacto:** pessoas próximas, gravações de tela e compartilhamentos podem capturar a senha temporária. A senha não é persistida pela aplicação nem registrada no histórico.

**Ação recomendada:** se a visibilidade continuar necessária, manter acesso administrativo restrito, evitar compartilhamento de tela durante o atendimento e exigir troca no primeiro login em uma evolução futura.

## Controles confirmados

- RLS está habilitada e forçada nas tabelas sensíveis; as 343 verificações de banco passaram.
- Visitantes não leem tabelas diretamente e recebem apenas o cartão publicado de conta ativa.
- Clientes não acessam dados de outros clientes, pagamentos, contatos administrativos, auditoria ou chamados.
- Funções `SECURITY DEFINER` revisadas fixam `search_path`; permissões de execução são revogadas e concedidas de forma explícita.
- A chave `SUPABASE_SECRET_KEY` está em módulo `server-only`, não possui prefixo público e não foi encontrada com valor real nos arquivos rastreados.
- Uploads validam propriedade, caminho, tamanho, decodificação e tipo real; SVG e conteúdo arbitrário não são aceitos.
- URLs de botões aceitam somente HTTP/HTTPS e textos são renderizados como texto; não foram encontrados `dangerouslySetInnerHTML`, `eval` ou execução de processo no código da aplicação.
- Login usa mensagens uniformes, controle de tentativas no servidor e resolução de identidade com chave secreta apenas no servidor.
- Pedidos de senha não enumeram contas, não duplicam pendência, têm limite no servidor e só são encerrados após sucesso no provedor de autenticação.
- Exclusão preserva aliases para impedir reutilização de URL/NFC; logs de auditoria não guardam senhas nem conteúdo integral do cartão.
- `.env`, `.env.local` e `.vercel` não estão rastreados; a varredura estática não encontrou segredo real versionado.
- `npm audit` encontrou zero vulnerabilidades conhecidas nas 493 dependências analisadas.

## Validação executada

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm run build` | passou; 15 páginas geradas |
| `npm run test:editor` | 25/25 passaram |
| `npm run test:admin` | 8/8 passaram |
| `npm run test:rls` | 343/343 passaram |
| `npm run test:editor:browser` | falhou antes de executar o cenário; achado A4 |
| `npm audit --json` | 0 vulnerabilidades |
| busca de segredos em arquivos rastreados | nenhum segredo real encontrado |
| estado do Git após auditoria | somente este relatório foi adicionado |

## Riscos operacionais e itens não comprovados

- A documentação manda gerar backup restaurável antes de migrations, mas a existência e um teste real de restauração do Supabase/Storage não foram comprovados.
- A separação entre desenvolvimento, preview e produção está documentada, mas não foi possível inspecionar toda a configuração remota.
- MFA para administradores é recomendada na documentação, porém sua exigência no projeto Supabase não foi comprovada pelo código.
- Foi criado um endpoint mínimo em `/api/health` e documentado o procedimento de resposta; a configuração do monitor externo e um exercício real ainda dependem da infraestrutura.
- O ambiente desta auditoria bloqueou a consulta HTTP direta ao domínio publicado; os cabeçalhos efetivos de produção não foram medidos.
- A skill instalada de conformidade informa que varredura OWASP/DAST pertence a uma skill de segurança dedicada, que não está instalada. Foi feita revisão estática manual, mas não houve scanner DAST, SAST especializado, teste de invasão ou análise do histórico completo do Git.
- Acessibilidade foi revisada estaticamente e há uso consistente de rótulos, `aria-*`, foco por teclado e zoom liberado. A execução automatizada com axe e a matriz completa de teclado/leitor de tela não foram concluídas porque o teste de navegador está quebrado.

## Ordem recomendada

1. Resolver e solicitar revisão do alerta do Google (A1).
2. Aprovar e publicar política de privacidade, retenção e procedimento de direitos (A2).
3. Restaurar o teste de navegador e executá-lo em desktop/mobile (A4).
4. Aplicar e validar os cabeçalhos de defesa (A3).
5. Confirmar cabeçalho confiável para o limite de recuperação (A5).
6. Padronizar erros públicos e corrigir o fluxo de observações (A6 e A7).
7. Registrar formalmente o risco da senha visível ou rever a decisão (A8).
8. Comprovar backup/restauração, MFA administrativa, observabilidade e resposta a incidente antes do lançamento.
