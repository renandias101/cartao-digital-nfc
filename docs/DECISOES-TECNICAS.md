# Decisões técnicas

Registro das decisões que não são óbvias pelo código (Arquitetura-e-Codigo 34,
Padroes-de-Qualidade 66). Uma entrada por decisão, com o motivo.

## D1 — Local do projeto: disco local, não Google Drive

**Data:** 29/09/2026 · **Etapa:** 1

O projeto vive em `C:\Users\Monteiro\Projetos\cartao-digital-nfc`, fora do
Google Drive. O Drive sincronizando `node_modules/` e `.next/` causa build
lento, lock de arquivos e conflitos de sincronização. O backup passa a ser o
repositório Git, não a sincronização do Drive.

O caminho `G:\Meu Drive\Trabalho\Projetos\CARTAO DE VISITA` é um arquivo de
0 byte, não uma pasta, e foi deixado intacto.

## D2 — Stack: Next.js 16 + Supabase

**Data:** 29/09/2026 · **Etapa:** 1

Next.js 16 (App Router, TypeScript) + Supabase (Postgres, Auth, Storage),
Tailwind CSS 4, deploy previsto na Vercel.

Motivos:

- **Isolamento no banco.** RLS atende o PRD §42 numa camada que um bug de
  aplicação não contorna, em vez de depender só de checagem em código.
- **Uploads.** O Storage resolve o PRD §10 sem serviço adicional; a Vercel não
  tem disco persistente.
- **Página pública rápida.** Renderização no servidor com cache por tag atende
  §52 sem abrir mão do bloqueio imediato por status (§23).
- **Hospedagem simples e de baixo custo**, com plano gratuito viável no início.
- É a combinação coberta pelas skills disponíveis para o agente.

Alternativa considerada e descartada: Postgres próprio com Prisma, auth
própria e storage S3/R2 — mais controle, porém isolamento apenas na aplicação,
mais peças para manter e nenhuma skill disponível cobrindo o conjunto.

## D3 — Login por nome de usuário sobre o Supabase Auth

**Data:** 29/09/2026 · **Etapa:** 1 · **Status:** decidido, implementação na etapa 4

O PRD §4 exige login por nome de usuário e senha, sem e-mail e sem
recuperação automática. O Supabase Auth é baseado em e-mail.

Decisão: manter o Supabase Auth e derivar internamente um e-mail sintético a
partir do `username`, com confirmação de e-mail desativada e nenhum fluxo de
recuperação habilitado. O cliente nunca vê nem informa e-mail.

Ganho: `auth.uid()` continua disponível, então as políticas RLS funcionam sem
autenticação paralela. Alternativa descartada: sessão própria, que exigiria
reimplementar hash, rotação e invalidação de sessão — proibido pelo princípio
de não enfraquecer segurança por conveniência (Seguranca 81-83).

## D4 — Scaffold pelo `create-next-app` oficial

**Data:** 29/09/2026 · **Etapa:** 1

A skill `senior-fullstack` traz um scaffolder próprio em Python para
"Next.js 14+". Foi preferido o CLI oficial, que entrega a versão atual
(16.3.7) e é mantido pelo time do framework — Arquitetura-e-Codigo 26
(dependência mantida) e Selecao-de-Skills 20 (não forçar o uso de uma skill só
porque ela existe). A skill segue válida como referência de arquitetura.

Observação: **Python não está instalado nesta máquina**, portanto os scripts
auxiliares dessa skill não são executáveis aqui de todo modo.

## D5 — `noUncheckedIndexedAccess` ativado

**Data:** 29/09/2026 · **Etapa:** 1

Acrescentado ao `tsconfig.json` além do `strict` padrão. O sistema é
orientado a listas (botões, clientes, resultados paginados) e essa regra
transforma acesso indevido a índice em erro de compilação em vez de falha em
produção.

## D6 — Chaves publicável e secreta, não `anon`/`service_role`

**Data:** 29/09/2026 · **Etapa:** 2

O Supabase está descontinuando as chaves `anon` e `service_role` (formato JWT)
até o fim de 2026, em favor de `sb_publishable_...` e `sb_secret_...`. As
variáveis passaram a se chamar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
`SUPABASE_SECRET_KEY`, seguindo os nomes da documentação atual.

Corrige o `.env.example` escrito na etapa 1, que usava os nomes legados.

## D7 — Sessão renovada no `proxy.ts`, autorização na camada de dados

**Data:** 29/09/2026 · **Etapa:** 2 · **Implementação na etapa 4**

No Next.js 16 o `middleware.ts` foi renomeado para `proxy.ts`, com export
nomeado `proxy` e runtime Node fixo (sem edge). Confirmado em
`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.

Server Components não escrevem cookies, então a renovação de token precisa
acontecer no `proxy.ts` — por isso o `setAll` do cliente de servidor engole a
exceção em `try/catch`, que é o comportamento esperado.

O `proxy.ts` **não** será usado como camada de autorização. O próprio doc do
Next avisa que proxy não serve para isso, e o PRD §42 exige a garantia no
backend. Autorização fica em RLS mais verificação na Server Action ou Route
Handler. O proxy apenas renova sessão.

Detalhe da versão instalada (`@supabase/ssr` 0.12.7): o `setAll` recebe um
segundo argumento `headers` que precisa ser aplicado à resposta. Sem ele, um
CDN pode cachear a resposta com cookie de sessão e servir a sessão de um
usuário para outro. Isso será aplicado no `proxy.ts` na etapa 4.

## D8 — Sem shadcn/ui por enquanto

**Data:** 29/09/2026 · **Etapa:** 2

Os tokens de cor usam a nomenclatura do shadcn/ui (`--background`,
`--foreground`, `--primary`, `--muted`, `--border`, `--ring`…) com o padrão
`@theme inline` do Tailwind 4, mas a biblioteca **não** foi instalada.

Motivo: não existe componente para construir ainda, e instalar Radix agora
seria dependência sem uso (Arquitetura-e-Codigo 25, 7). A decisão é revisitada
na etapa 6, onde surgem tabela, diálogo e formulário de verdade. Como a
nomenclatura já está compatível, adotar depois não exige renomear nada.

Pela mesma razão não foi criado um utilitário `cn()`: sem componentes, não há
consumidor, e ele exigiria `clsx` e `tailwind-merge`.

## D9 — Fonte do sistema, sem webfont

**Data:** 29/09/2026 · **Etapa:** 2

A pilha de fontes é a do sistema operacional. Uma webfont custaria requisição
de rede e risco de deslocamento de layout numa página que é aberta por NFC em
internet móvel (PRD §52). Revisitar na etapa 9 apenas se a direção visual da
página pública exigir uma fonte de display.

## D10 — Leitura preguiçosa das variáveis de ambiente

**Data:** 29/09/2026 · **Etapa:** 2

`src/lib/env.ts` expõe getters em vez de constantes validadas no carregamento
do módulo. Validar na importação derrubaria o build em qualquer ambiente sem
`.env.local` configurado. Com getter, a falha acontece no uso, com mensagem
que diz exatamente qual variável falta.

`src/lib/env.server.ts` importa `server-only`: se código de cliente alcançar a
chave secreta, o build falha em vez de vazar o segredo.

## D11 — Status derivado das datas, sem coluna `status`

**Data:** 29/09/2026 · **Etapa:** 3

Não existe coluna `status` em `clients`. O status vem de
`public.effective_status(expires_at, cancelled_at)`, com esta precedência:
cancelamento manual, 15 dias após o vencimento, vencimento, ativo.

Motivo: o PRD §23 exige que a página pública fique indisponível
**imediatamente** ao vencer, e o §26 que o cancelamento após 15 dias seja
automático. Com coluna armazenada, a correção passaria a depender de um job
ter rodado, e qualquer atraso ou falha dele deixaria cartão vencido no ar —
exatamente o que o PRD proíbe. Derivado, o bloqueio é instantâneo e não existe
estado capaz de divergir da realidade.

Consequência boa: nenhuma necessidade de `pg_cron` para correção. A etapa 5
fica só com renovação e avisos, sem job.

Consequência a observar: filtros administrativos (§36) usam a função em vez de
uma coluna indexável. Com a base pequena que o projeto terá isso é irrelevante;
se algum dia pesar, a saída é um índice de expressão sobre `expires_at`, que já
existe.

## D12 — Rascunho e versão publicada em tabelas separadas

**Data:** 29/09/2026 · **Etapa:** 3

`card_drafts` e `card_published` são tabelas distintas, não duas colunas da
mesma linha.

Motivo, e é de segurança: **RLS filtra linhas, não colunas.** Se rascunho e
versão publicada dividissem a linha, qualquer papel autorizado a ler a linha
leria os dois, e o §17 ("a página pública usa somente a versão publicada")
passaria a depender de o código lembrar de selecionar a coluna certa. Separadas,
a garantia é estrutural.

O conteúdo é um documento `jsonb` em vez de tabelas relacionais de botões.
Publicar e restaurar viram operação de uma linha, atômica por construção — não
há como publicar meia versão. E a leitura pública fica em uma consulta só, o que
serve ao §52. O custo é que a validação fina do documento não cabe em
constraint; o banco garante o que é estrutural (é objeto, `buttons` é array,
no máximo 10, teto de 64 kB) e o resto entra como função de validação na etapa 8.

## D13 — Acesso público por função, não por política de leitura

**Data:** 29/09/2026 · **Etapa:** 3

O papel `anon` **não tem privilégio em nenhuma tabela**. O visitante só pode
chamar `public.get_public_card(username)`, que devolve o cartão publicado de um
cliente ativo ou `NULL`.

Motivo: para resolver um username o visitante precisaria ler `clients`, que
contém vencimento e cancelamento. Isso violaria o §21 (visitante nunca vê status
interno). Com a função, o visitante recebe exatamente o mesmo `NULL` para cartão
inexistente, nunca publicado, vencido, cancelado e excluído — §24, §27, §49 e
§50 ficam garantidos por construção, não por disciplina de quem escreve a
interface.

A função recebe nome de usuário e nunca id, então não há superfície de
enumeração. É `security definer` com `search_path` fixo, e o único caminho
público existente.

## D14 — Verificação de RLS em Postgres WASM

**Data:** 29/09/2026 · **Etapa:** 3

Não há Docker nem psql nesta máquina, e não existe projeto Supabase criado.
Para não afirmar "o isolamento está garantido" sem evidência — proibido pela
Regra Geral 27 — os testes rodam num Postgres real compilado para WASM
(PGlite 0.5.8, PostgreSQL 18.3), sobre um shim mínimo da superfície do Supabase
em `supabase/tests/supabase-shim.sql`.

O harness aplica as migrations de verdade, assume cada papel e verifica quem
alcança o quê: 58 asserções, todas passando.

Limite honesto: o shim não é o Supabase. Falta o Auth real, o Storage, os
gatilhos internos e as extensões. A lógica das políticas está provada; a
validação final contra o projeto real continua pendente e obrigatória.

## D15 — Nesta etapa o cliente não escreve em tabela nenhuma

**Data:** 29/09/2026 · **Etapa:** 3

O cliente recebe apenas SELECT das próprias linhas. Não há política de escrita
para ele em `card_drafts` nem em `card_published`.

Motivo: escrita direta pela API de dados contornaria toda validação da
aplicação — daria para gravar título de 5.000 caracteres ou URL `javascript:`.
Em vez de abrir a escrita agora e tapar o buraco depois, os caminhos de escrita
entram na etapa 7 como funções `security definer` que validam antes de gravar.
Até lá não existe buraco para fechar.

Publicar segue sendo operação de função, e não UPDATE do cliente, em definitivo:
é o que impede publicar conteúdo forjado sem passar por validação.

## D16 — Bloqueio por tentativas implementado na aplicação, não no Supabase

**Data:** 29/09/2026 · **Etapa:** 4

Confirmado na documentação oficial (não por suposição): o Supabase Auth não
bloqueia conta por tentativas de login. Só limita por IP em endpoints
específicos (`/auth/v1/token`, `/auth/v1/verify`) e recomenda CAPTCHA como
mitigação adicional.

Implementado em `private.login_throttle` + três funções atômicas
(`register_login_failure`, `register_login_success`, `check_login_lock`),
chave por username (não por user_id, para também limitar tentativas contra
contas que não existem). Ao atingir 5 falhas, além de bloquear na própria
tabela por 15 minutos, a Server Action chama `auth.admin.updateUserById` com
`ban_duration` — reforço que vale mesmo se alguém chamar a API do Supabase
direto, ignorando esta aplicação.

CAPTCHA (recomendação do próprio Supabase) não foi adicionado: exigiria uma
conta em serviço externo (hCaptcha/Turnstile) e é desproporcional para um
sistema de um único administrador e dezenas/centenas de clientes. Revisitar
se o volume de tentativas de força bruta observado no log justificar.

## D17 — `USAGE` em schema, não só `EXECUTE` em função

**Data:** 29/09/2026 · **Etapa:** 4

Bug real encontrado e corrigido durante os testes, não hipotético: uma
política de RLS que chama `private.is_admin()` funciona só com `GRANT EXECUTE`
na função, porque o nome já foi resolvido na criação da política. Mas o mesmo
`private.is_admin()` chamado de dentro de OUTRA função (`public.am_i_admin`)
falha com "permission denied for schema private" sem `GRANT USAGE` no schema
— ali o nome é resolvido a cada chamada, sob o papel de quem invoca.

A correção foi adicionar `grant usage on schema private to authenticated;`,
não trocar `am_i_admin()` para `security definer` — a skill de Postgres é
explícita: `security definer` não deve ser usado para "resolver" um erro de
permissão, isso remove o controle de acesso sem corrigir a causa. `USAGE`
sozinho não expõe dado nenhum: quem tenta ler `private.admins` ou
`private.login_throttle` diretamente continua barrado por RLS e por não ter
`GRANT` de tabela nenhum.

## D18 — `private` nunca exposto à API de dados, nem para o script de admin

**Data:** 29/09/2026 · **Etapa:** 4

`scripts/create-admin.mjs` precisava gravar em `private.admins`. A primeira
versão usava `.schema('private').from('admins').upsert(...)` — o que exigiria
adicionar `private` à lista de schemas expostos no painel (Project Settings >
Data API), desfazendo exatamente o isolamento que motivou colocar essas
tabelas em `private` desde a etapa 3.

Corrigido com o mesmo padrão já usado no resto do projeto: um wrapper fino em
`public` (`public.upsert_admin`, `security invoker`, `execute` só para
`service_role`) que grava em `private.admins` por dentro. O schema `private`
segue nunca exposto.

## D19 — Proxy sem consulta a banco, por instrução explícita do Next

**Data:** 29/09/2026 · **Etapa:** 4

O guia oficial do Next 16 para checagens otimistas em Proxy é direto: como o
Proxy roda em toda navegação, inclusive prefetch, "avoid database checks to
prevent performance issues". Por isso `src/proxy.ts` só verifica se existe
sessão (via `getUser()`, que o próprio Supabase exige em proxy para renovar
token) — nunca chama `am_i_admin()`, que é uma ida ao Postgres.

Decidir se quem está logado é admin ou cliente acontece dentro de `/admin` e
`/painel`, que já renderizam por requisição de qualquer forma. O `matcher` do
proxy cobre só `/login`, `/painel/*` e `/admin/*` — a página pública do
cartão fica inteiramente fora, com custo zero de proxy, por ser o caminho de
maior tráfego do sistema (PRD §52).

## D20 — Reautenticação exigida para trocar a própria senha

**Data:** 29/09/2026 · **Etapa:** 4

O PRD só diz que o cliente "poderá alterar sua própria senha" (§4), sem
detalhar o fluxo. `trocarSenha()` exige a senha atual antes de aceitar a
nova, reautenticando via `signInWithPassword` antes de chamar
`auth.updateUser`.

Motivo: sem essa checagem, uma sessão aberta e esquecida (computador
compartilhado) permitiria a qualquer pessoa trocar a senha sem saber a
original. Não é exigência literal do PRD, mas é a leitura mais segura de uma
instrução aberta — coerente com a prioridade 1 (segurança) da lista de
prioridades técnicas.

## D21 — Migrations locais, aplicação no projeto real pendente

**Data:** 29/09/2026 · **Etapa:** 4

Confirmado por tentativa real (não suposição): `supabase link` exige um
Personal Access Token da conta Supabase, e `supabase db push` exige, além
disso, a senha do Postgres do projeto — nenhuma das duas coisas foi
fornecida, e as chaves `publishable`/`secret` da API não dão esse acesso
(PostgREST não executa DDL arbitrário).

As três migrations (`schema_inicial`, `rls_e_privilegios`, `autenticacao`)
estão prontas e passam 74 verificações de RLS/isolamento num Postgres real
(PGlite). A aplicação no projeto de produção fica pendente de uma de duas
ações do usuário: rodar os três arquivos no SQL Editor do painel (sem
precisar compartilhar nenhum segredo novo), ou fornecer a senha do banco para
aplicação via CLI.

## D22 — Login validado de ponta a ponta contra o projeto real

**Data:** 30/09/2026 · **Etapa:** 4

Migrations aplicadas pelo usuário via SQL Editor do painel Supabase (opção A).
Admin real criado via `scripts/create-admin.mjs`: usuário `renandias101`, id
`d99b4879-3e67-4bba-b101-7ec43fd819b6`.

Validado contra o projeto real (não só PGlite): senha errada rejeitada, senha
certa aceita, `am_i_admin()` retorna `true` via RPC com a sessão real,
`getUser()` confirma o JWT contra o servidor do Auth. Uma falha deliberada foi
registrada e depois limpa, para não deixar rastro na conta real e para não
chegar perto do limite de 5 (evitar bloquear a conta de propósito só para
testar — a lógica do limite já está coberta pelos 74 testes em PGlite).

## D23 — Postgres já ajusta fim de mês; sem lógica manual de clamping

**Data:** 30/09/2026 · **Etapa:** 5

Testado direto no Postgres antes de escrever qualquer função: `date + interval
'N months'` já produz o resultado correto quando o mês de destino tem menos
dias — `30/11 + 3 meses = 28/02`, `31/01 + 1 mês = 28/02`, `31/12 + 2 meses =
28/02`. Resolve a segunda metade de P4 sem código adicional.

## D24 — `America/Belem`: offset fixo, sem horário de verão

**Data:** 30/09/2026 · **Etapa:** 5

Confirmado comparando janeiro e julho no mesmo cálculo: `America/Belem` fica
em `-03:00` o ano inteiro (Brasil aboliu horário de verão nacionalmente em
2019). Resolve a primeira metade de P4 — não há necessidade de tratar
transição de horário de verão em nenhum cálculo de vencimento.

## D25 — Convenção de armazenamento: `expires_at` guarda o início do dia seguinte

**Data:** 30/09/2026 · **Etapa:** 5

"Vence no fim do dia D" (P4) é armazenado como o instante `D+1 00:00:00` em
`America/Belem`, convertido para UTC — não como `D 23:59:59.999999`. As duas
formas são matematicamente equivalentes no limite, mas a primeira evita
qualquer discussão sobre quantas casas decimais de segundo usar. O último
instante de D permanece ativo; `effective_status` já compara com `>`
estrito, então a mudança de status acontece exatamente na virada para D+1.

Para recuperar D a partir de um `expires_at` já salvo (necessário para somar
meses a um cliente ainda ativo, §30), `compute_new_expiry` subtrai 1
microssegundo antes de converter para o fuso — funciona mesmo que o valor
armazenado não caia exatamente à meia-noite, então não depende de nenhum
outro código respeitar esse invariante à risca.

## D26 — Autorização de renovar/cancelar/excluir delegada inteiramente ao RLS

**Data:** 30/09/2026 · **Etapa:** 5

`renew_client`, `cancel_client` e `delete_client` são `SECURITY INVOKER` e
não chamam `private.is_admin()` dentro de si. A autorização já existe nas
políticas de UPDATE/DELETE de `clients` (criadas na etapa 3); se a operação
não afetar nenhuma linha, é porque a política negou, e a função detecta isso
por `FOUND` (padrão idiomático do PL/pgSQL) e devolve um erro claro.

Ganho: uma única fonte de verdade para "quem pode alterar um cliente" — a
política de RLS — em vez de duas cópias da mesma regra que poderiam divergir
com o tempo (Arquitetura-e-Codigo 19).

## D27 — Regra "só exclui CANCELADO" reforçada na própria política de RLS

**Data:** 30/09/2026 · **Etapa:** 5

O PRD §66 lista isso como critério de aceite, não só como comportamento do
painel. Por isso a política `clients_delete_admin` foi apertada para exigir
`is_admin() AND effective_status(...) = 'cancelled'` — testado com um DELETE
cru, por fora de qualquer função da aplicação, provando que a trava está no
banco e não apenas na interface.

## D28 — Auditoria de exclusão por gatilho, não só dentro de `delete_client`

**Data:** 30/09/2026 · **Etapa:** 5

Um `AFTER DELETE` em `clients` insere o registro de auditoria
automaticamente, cobrindo também uma exclusão feita por fora da aplicação
(por exemplo, apagando o usuário direto no painel do Supabase, que cascateia
para `clients`). Isso foi corrigido depois de um erro real encontrado pelos
próprios testes: a primeira versão tentava inserir `client_id = old.id`, mas
nesse instante a linha já não existe mais em `clients` — a FK rejeitava a
inserção. Corrigido para gravar `client_id = null` diretamente, que é
justamente por isso essa coluna é anulável.

## D29 — Cancelamento repetido não duplica entrada no histórico

**Data:** 30/09/2026 · **Etapa:** 5

Bug real encontrado pelos testes: a primeira versão de `cancel_client`
inseria um registro de auditoria toda vez que era chamada, mesmo quando não
havia mudança nenhuma (cliente já cancelado, `coalesce` sem efeito). Corrigido
para só registrar quando o cancelamento é de fato novo — comparando o estado
antes e depois da atualização.

## D30 — Listagem por RPC com parâmetros, não `.or()` do PostgREST

**Data:** 30/09/2026 · **Etapa:** 6

A busca por nome/usuário (§37) foi implementada como `public.list_clients_for_admin`,
uma função com parâmetros de verdade, em vez de montar uma string de filtro
para o método `.or()` do PostgREST. Confirmado na documentação oficial: esse
DSL exige envolver valor com caractere especial em aspas duplas para escapar
— minha primeira tentativa escapava com backslash, que é o mecanismo errado.
Uma função com parâmetro elimina o problema por completo: o termo de busca é
sempre um valor ligado, nunca uma sintaxe que ele possa alterar. Testado com
um termo contendo vírgula e parênteses (caracteres que teriam significado
especial no DSL), confirmando que não altera a estrutura da consulta.

A mesma função também resolve filtro por status, "vence em até 15 dias" e
paginação, devolvendo o total via `count(*) over()` — uma função em vez de
encadear várias, porque a listagem sempre precisa dessas peças juntas.

## D31 — `clients_with_status`: view com `security_invoker`

**Data:** 30/09/2026 · **Etapa:** 6

Enriquece `clients` com `status` e `days_until_expiry` como colunas comuns,
usada tanto pela listagem quanto pela tela de detalhe. `WITH
(security_invoker = true)` é obrigatório — sem isso, a view rodaria com o
privilégio de quem a criou, ignorando o RLS de `clients` por completo (é
exatamente o alerta da skill de Postgres sobre views). Testado: um cliente
comum consultando a view vê só a própria linha, igual consultando a tabela
direto.

## D32 — Tipos de retorno do Supabase: `as` direto, sem `Database` gerado

**Data:** 30/09/2026 · **Etapa:** 6

`supabase gen types typescript` ainda não pode ser rodado (exige Docker local
ou credenciais que não temos — mesma pendência da etapa 4/5). Sem um
`Database` genérico no cliente, `.overrideTypes()` encadeado com
`.select("*")` ou com RPC que devolve tabela produz inferência conflitante
consigo mesma — confirmado tentando: a mesma chamada ora presume array, ora
presume objeto único, dependendo de detalhes anteriores na cadeia. Substituí
por `as` direto no resultado desestruturado nessas funções específicas —
menos elegante, mas previsível, e o formato usado é exatamente o que cada
função SQL devolve, não suposição.

Pendência clara: revisitar com tipos gerados de verdade assim que houver
acesso ao banco (Docker local, ou token de acesso da conta Supabase — etapa 17).

## D33 — `<Link>` do Next, não `<a>`, para toda navegação interna

**Data:** 30/09/2026 · **Etapa:** 6

O ESLint do projeto (`eslint-config-next`) já pega isso automaticamente —
`<a href="/rota-interna">` some o prefetch e a navegação sem recarregar a
página inteira que o `<Link>` dá de graça. Convertido em todos os links
novos do painel administrativo.

## D34 — CHECK constraint via função, com dois modos (permissivo/completo)

**Data:** 30/09/2026 · **Etapa:** 7

`public.validate_card_content(content, require_complete)` valida nome
(≤60), descrição (≤250), cor de fundo e cor dos botões (hex) e os campos de
imagem (devem ser string, se presentes). Usada como `CHECK constraint` em
`card_drafts` (modo permissivo — campo ausente é ok, rascunho pode estar em
andamento) e em `card_published` (modo completo — nome e cores viram
obrigatórios, PRD §8 não lista os dois como opcionais).

Bug real encontrado pelos testes: `NULL ~ regex` no Postgres devolve `NULL`,
não `false` — e uma CHECK constraint que resulta em `NULL` é **tratada como
aprovada**. A primeira versão da função permitia publicar sem
`backgroundColor`/`buttonColor` por causa disso. Corrigido explicitando
`is not null and ... ~ regex` em vez de confiar no operador `or` sozinho.

## D35 — Cliente escreve o próprio rascunho por RLS; publicar continua sendo só função

**Data:** 30/09/2026 · **Etapa:** 7

`card_drafts` ganhou uma política de UPDATE para o próprio dono — a
validação de conteúdo mora inteira na CHECK constraint (D34), não numa
função separada, então uma política de RLS simples é suficiente e mais
simples que uma função dedicada.

`card_published` **não** ganhou política equivalente — decisão mantida da
etapa 3 (D15). Cheguei a escrever essa política e reverti ao perceber a
contradição: mesmo com conteúdo validado, deixar o cliente escrever direto
ali permitiria publicar algo que nunca passou pelo rascunho, quebrando o
modelo rascunho -> revisão -> publicação do PRD §16-17. `publish_card()` é
`SECURITY DEFINER` — e esse é um dos poucos casos em que isso é a ferramenta
certa, não um atalho: a função não recebe parâmetro nenhum (opera só sobre
`auth.uid()`), então não há "de quem" para um chamador manipular.

## D36 — `tsx` como dependência de desenvolvimento

**Data:** 30/09/2026 · **Etapa:** 7

O teste de paridade entre `validarConteudoCartao` (TS) e
`validate_card_content` (SQL) precisa importar um módulo `.ts` que por sua
vez importa outros via o alias `@/` do `tsconfig.json`. Node puro não
resolve esse alias (é um recurso do bundler/compilador, não do runtime) —
confirmado tentando. `tsx` resolve `paths` do `tsconfig.json` nativamente;
trocado o script `test:rls` para usá-lo em vez de `node` diretamente.

## D37 — Cache de schema do PostgREST precisa de `NOTIFY` após DDL manual

**Data:** 30/09/2026 · **Etapa:** 7

Depois de aplicar a migration desta etapa via SQL Editor, as funções novas
(`publish_card`, `restore_draft`, `validate_card_content`) não apareciam nas
chamadas via `supabase-js` — confirmado tentando duas vezes, sem ser
coincidência. Causa: o PostgREST mantém um cache do schema e só o recarrega
sozinho quando a alteração passa pela ferramenta de migração dele ou quando
recebe `NOTIFY pgrst, 'reload schema'` explicitamente — uma DDL solta pelo
SQL Editor não dispara isso automaticamente em todo caso.

Registrado como passo permanente: **depois de qualquer migration aplicada
manualmente pelo SQL Editor, rodar `NOTIFY pgrst, 'reload schema';` em
seguida.**

## D38 — Validação de botão sempre estrita, sem modo permissivo

**Data:** 30/09/2026 · **Etapa:** 8

Diferente de `validate_card_content` (que tem modo permissivo para
rascunho), `validate_button` não tem — um botão presente no array precisa
estar sempre completo para o próprio tipo. Não existe "botão pela metade":
o editor (etapa 12) só adiciona um botão ao array depois de o cliente
preencher os campos obrigatórios daquele tipo; não há um estado intermediário
de "rascunho de botão" que precise ser persistido.

## D39 — `coalesce(..., false)` no resultado inteiro, não só nos pontos conhecidos

**Data:** 30/09/2026 · **Etapa:** 8

A etapa 7 corrigiu um caso específico do bug de `NULL` em CHECK constraint
(D34). Nesta etapa, com 6 tipos e vários campos condicionalmente obrigatórios,
o mesmo problema apareceria de novo em pelo menos dois pontos (`enabled`
ausente, `type` fora da lista) se eu caçasse cada sub-expressão isoladamente.
Em vez disso, o resultado inteiro de `validate_button` (e, retroativamente,
de `validate_card_content`) é embrulhado em `coalesce(..., false)` — a função
nunca devolve `NULL`, só `true` ou `false`, fechando essa classe de bug de
uma vez por todas nas duas funções, não só nos casos já percebidos.

## D40 — PIX, Wi-Fi, telefone e endereço sem campo de título obrigatório

**Data:** 30/09/2026 · **Etapa:** 8

O PRD lista "título" como campo explícito só para Link (§13.1) e
Texto/Informação (§13.2); os outros quatro tipos (§13.3-§13.6) têm apenas seu
campo específico. Título ficou opcional para os quatro, não removido —
o cliente pode nomear um botão de Wi-Fi como "Rede da loja", por exemplo, mas
não é obrigado. Nenhum campo novo foi inventado além do que o PRD já cobre
genericamente em "conteúdo dos botões" (§9).

## D41 — Ordem do botão é a posição no array, sem coluna separada

**Data:** 30/09/2026 · **Etapa:** 8

"Reorganizar por arrastar e soltar" (§11) não precisa de uma coluna de
ordenação: a posição de cada elemento no array `buttons` (JSONB) já é a
ordem. `reordenarBotoes` (TS) só reconstrói o array na sequência de ids
desejada — nenhuma escrita adicional no banco além do `UPDATE` de sempre.

## D42 — `get_public_card` filtra botões desativados no servidor, não na UI

**Data:** 30/09/2026 · **Etapa:** 8 (correção pós-verificação)

Achado na minha própria verificação de ponta a ponta desta etapa: a função
pública devolvia o array de botões inteiro, incluindo os desativados,
deixando a filtragem por conta de quem for renderizar a página pública
(etapa 9, ainda não construída). Isso contraria o princípio seguido no resto
do projeto — nunca confiar só no frontend para uma regra que importa
(Seguranca 11-12; PRD §11: "botões desativados não aparecem na página
pública" é comportamento, não sugestão de UI).

Corrigido na própria função, que já é a fonte única do que o visitante
recebe: `jsonb_agg` com `WITH ORDINALITY` reconstrói o array só com os
elementos `enabled = true`, preservando a ordem original. Testado com 5
botões (3 ativos intercalados com 2 desativados) e com array vazio.

## D43 — Página pública sem cache entre requisições

**Data:** 30/09/2026 · **Etapa:** 9

Pesquisei a API de cache do Next 16 antes de implementar (o próprio
`AGENTS.md` do projeto avisa que essa versão diverge de convenções
anteriores). Achado importante: o mecanismo "recomendado" para revalidação
sob demanda (`revalidateTag(tag, 'max')`) serve **conteúdo desatualizado de
propósito** por até um ano, atualizando em segundo plano
(stale-while-revalidate) — o oposto do que o PRD exige em §23 e §64
("a página pública deverá ficar indisponível imediatamente" / "a página
pública volta a funcionar imediatamente").

Existe `updateTag`, que expira o cache de verdade e serve a versão nova já na
próxima requisição — mas só funciona dentro de Server Actions, e sua
interação com `unstable_cache` (que o próprio Next 16 marca como substituído
por `"use cache"`) não está clara na documentação atual, e `"use cache"`
exige o flag `cacheComponents: true`, uma mudança de arquitetura para o
projeto inteiro, não só para esta página.

Decisão: a página pública roda sem nenhuma camada de cache adicional nesta
etapa — cada requisição consulta o Postgres direto (`get_public_card`,
`username_exists`), sempre correta. `cache()` do React só deduplica a mesma
consulta DENTRO de uma única requisição (entre `generateMetadata` e a
página), sem guardar nada entre visitantes diferentes.

Isso prioriza corretude (prioridade 1 da lista) sobre uma otimização de
performance ainda não medida como necessária. Revisitar com dados reais de
latência nas etapas 14 (responsividade e performance) ou 17 (deploy) — uma
consulta indexada simples não deve ser o gargalo real nesta escala.

## D44 — Cliente Supabase sem cookies para a página pública

**Data:** 30/09/2026 · **Etapa:** 9

`src/lib/supabase/anon.ts` cria o cliente sem passar por `cookies()` do Next
— diferente do cliente de servidor usado no painel. Dois motivos: o
visitante nunca tem sessão (não haveria cookie relevante para ler), e chamar
`cookies()` força a rota inteira a ser tratada como dependente de dado de
requisição pelo Next, mesmo quando o cookie nunca é de fato usado.

## D45 — `<details>/<summary>` nativo para os botões que "abrem ao clicar"

**Data:** 30/09/2026 · **Etapa:** 9

Texto/Informação, Wi-Fi, PIX, telefone e endereço (PRD §13.2-§13.6, "ao
clicar: mostrar...") usam o elemento nativo `<details>/<summary>` em vez de
um componente de cliente com estado — funciona sem JavaScript, é semântico e
acessível de graça. Só o botão de copiar (PIX, telefone, senha Wi-Fi — PRD
§47) é um componente de cliente, e é o único código de cliente que a página
carrega — Link não precisa de nada, é uma âncora comum.

## D46 — `username_exists` só revela existência, nunca status

**Data:** 30/09/2026 · **Etapa:** 9

Relendo o PRD com mais cuidado percebi uma tensão que não tinha notado na
etapa 3: `get_public_card` devolve `NULL` igual para "nunca existiu" e para
"vencido/cancelado", de propósito (§21 proíbe revelar o status) — mas §24,
§27 e §49 pedem DUAS mensagens diferentes ("não foi encontrado" vs. "não
está disponível"), que essa função sozinha não permite escolher. Resolvido
com uma segunda função mínima que revela só "existe ou não" — nunca a
palavra do status —, o suficiente para a página escolher a mensagem certa
sem violar o §21.

## D47 — `notFound()` devolve HTTP 200, não 404 — comportamento aceito, não corrigido

**Data:** 30/09/2026 · **Etapa:** 9

Testado em build de produção real, não só em dev: `/e2e-nunca-existiu`
devolve status **200**, mesmo chamando `notFound()`. Confirmado na própria
documentação do Next 16 (`file-conventions/loading.md`, seção "Status
Codes"): **"quando streaming, o status sempre é 200 — os headers já foram
enviados antes de o `notFound()` decidir"**. Como o `loading.tsx` da raiz
(etapa 2) cria um limite de streaming automático em toda rota abaixo dele, e
`/[username]` não tem como evitar isso permanecendo uma página normal, a
página é servida em streaming e o status fica travado em 200.

A própria documentação aponta a correção: checar a existência dentro do
`proxy.ts` antes de a página começar a streamar. Decidi **não fazer isso**:
o `proxy.ts` desta rota deliberadamente não roda (D19), exatamente para não
acrescentar uma consulta ao banco na página de maior tráfego do sistema
(aberta por NFC, PRD §52). Colocar a checagem lá desfaria essa decisão para
"consertar" um código de status que o PRD nunca menciona.

O que realmente importa ao PRD (§49: mensagem não técnica, sem vazar dado) já
está garantido: confirmado que a página mostra o texto certo, nunca o nome
do cliente, e o Next já injeta `<meta name="robots" content="noindex">`
sozinho nessas páginas — que é o mecanismo que impede indexação por buscador
mesmo com HTTP 200 (a própria documentação chama isso de "soft 404" e explica
que o `noindex` resolve o problema de SEO sem precisar do status correto).

Revisitar apenas se surgir uma exigência real de compliance/analytics que
dependa do código HTTP exato — não antes disso.

## D48 — Validação de imagem por decodificação real, não por extensão/MIME

**Data:** 30/09/2026 · **Etapa:** 10

`processarImagem` chama `sharp(buffer).metadata()` e só aceita o formato que
o `sharp` de fato DECODIFICOU do arquivo — nunca a extensão do nome nem o
`Content-Type` que o navegador declarou. É a regra 53-54 de Segurança do
framework, aplicada literalmente: um arquivo de texto renomeado para
`foto.png` é rejeitado, porque não decodifica como imagem nenhuma — testado.

Toda imagem aceita é reconvertida para WebP (qualidade 80) e redimensionada
por propósito (perfil 800px, banner/fundo 1600px, ícone 256px) — é isso que
cumpre "otimização e compressão" do PRD §10, não apenas aceitar o arquivo
como veio.

## D49 — Nome de arquivo fixo por propósito, com upsert

**Data:** 30/09/2026 · **Etapa:** 10

**Revisão em 03/10/2026 (correções funcionais, etapa 1):** a implementação
abaixo foi substituída por `{client_id}/{proposito}-{uuid}.webp`, com
`upsert: false`. O caminho fixo permitia alterar a imagem publicada durante
a edição do rascunho, violando a separação obrigatória entre versões.
As URLs existentes continuam funcionando; nenhum arquivo foi excluído.
Versões não utilizadas podem se acumular; limpeza segura por referências
fica para uma etapa própria, sem apagar imagens ainda em uso.

`{client_id}/banner.webp`, `{client_id}/profile.webp` etc. — nome fixo, não
com sufixo aleatório. Reenviar substitui (`upsert: true`) sem precisar
apagar o arquivo anterior antes, e sem deixar versões órfãs acumulando no
Storage a cada troca de foto.

## D50 — Migration de Storage fora da suíte local (PGlite)

**Data:** 30/09/2026 · **Etapa:** 10

`20260930160000_upload_de_imagens.sql` referencia `storage.objects` e
`storage.foldername()` — a extensão de Storage do Supabase, que não existe
no PGlite puro (só o `auth` foi replicado, na etapa 3, por ser a base de
tudo o mais). Replicar a extensão inteira de Storage só para esta migration
não se paga: a lógica da política aqui é simples (prefixo de pasta = dono),
e já testada seriamente noutro nível (isolamento por `auth.uid()`, 170
verificações). Esta migration foi validada por teste real contra o projeto
— criei dois clientes descartáveis, testei envio, conversão de verdade
(baixei o arquivo salvo e decodifiquei de novo), isolamento entre eles, e
acesso público sem sessão.

## D51 — Criação do bucket por script, não por migration SQL

**Data:** 30/09/2026 · **Etapa:** 10

`scripts/create-storage-bucket.mjs`, não uma instrução SQL. Criar bucket é
uma chamada da API administrativa de Storage (`createBucket`), que valida
internamente os parâmetros — inserir direto em `storage.buckets` via SQL
seria replicar essa validação por conta própria, sem necessidade. Já
executado contra o projeto real (bucket `card-images`, público, ≤5MB,
jpeg/png/webp).

## D52 — Processamento de imagem separado do módulo `server-only`

**Data:** 30/09/2026 · **Etapa:** 10

`processarImagem` (decodificar, redimensionar, converter para WebP) mora em
`src/lib/card/image-processing.ts`, sem `server-only` — só `src/lib/card/
images.ts` (sessão, Storage) tem essa marca. Achado ao tentar testar de
verdade: um script de verificação chamando a função inteira caía no mesmo
bloqueio do `server-only` (só o bundler do Next entende essa importação), e
sem o refactor eu só conseguiria testar a mecânica do Storage, nunca provar
que a conversão/redimensionamento realmente acontece.

Com a separação — mesmo padrão já usado em `buttons.ts` (puro) vs.
`draft.ts` (sessão) —, a suíte de testes chama `processarImagem` direto: PNG
2000×1000 realmente vira WebP ≤1600px (banner) ou ≤256px (ícone), arquivo de
texto disfarçado de imagem é rejeitado pela decodificação real, imagem menor
que o limite não é ampliada. A verificação real contra o Storage (RLS,
isolamento entre clientes, acesso público, limite de 5MB) usou o buffer
JÁ PROCESSADO por esta função — não um arquivo cru —, provando o caminho
completo de ponta a ponta, não só a mecânica de armazenamento isolada.

## D53 — P5 resolvida: painel do cliente inativo é somente leitura, travado no banco

**Data:** 30/09/2026 · **Etapa:** 11

Fechamento da pergunta aberta desde a etapa 3: hoje, antes desta etapa, um
cliente CANCELADO ou VENCIDO ainda conseguia editar o rascunho e publicar —
nada impedia. O PRD §22 lista edição e publicação como características do
status ATIVO, o que sugere que não valem fora dele.

Implementado e testado: `card_drafts_update_own` (RLS) agora exige
`private.client_is_active(auth.uid())` além da posse; `publish_card()` e
`restore_draft()` (que são `security definer`/bypassam RLS) fazem a mesma
checagem explícita dentro do próprio corpo. Leitura do rascunho e do
publicado continua sempre liberada — só a ESCRITA fica presa ao status.
Testado com clientes vencido e cancelado reais (seção 29, 8 verificações) e
com um cliente ativo de controle, confirmando que a trava é seletiva.

Ainda reversível se a leitura correta do PRD for outra — é uma interpretação
razoável do texto, não uma certeza; documentado como decisão, não como fato
do PRD.

## D54 — Verificação desta etapa não cobriu renderização em navegador real

**Data:** 30/09/2026 · **Etapa:** 11

Diferente das etapas anteriores (onde simulei sessão real via
`supabase-js` chamando RPCs diretamente), o painel do cliente é uma página
Next renderizada a partir de cookie de sessão — reproduzir isso via `curl`
exigiria replicar manualmente o formato de cookie do `@supabase/ssr`
(potencialmente fragmentado em várias entradas) ou instalar uma ferramenta
de automação de navegador, desproporcional para esta checagem.

O que tem risco de segurança real (bloqueio de escrita fora do status
ativo) já foi provado com 185 testes, incluindo os 8 desta etapa contra
clientes vencido/cancelado reais. A renderização em si é JSX condicional
direto, sem lógica nova além de exibir dados já testados
(`clients_with_status`, `effective_status`). `npm run build` confirma que
compila e o Next analisa toda a árvore estaticamente sem erro.

Registrado com transparência: a interface visual desta página não foi
clicada num navegador de verdade nesta rodada. Ofereço fazer isso se for
importante antes de prosseguir.

## D55 — Reordenar por botões ▲▼, não arrastar e soltar

**Data:** 30/09/2026 · **Etapa:** 12

O PRD §11 pede "arrastar e soltar" para reorganizar botões. Implementei
subir/descer por botão em vez disso — decisão consciente, não descuido:
drag-and-drop nativo do HTML5 tem suporte ruim em touch (o dispositivo que
mais importa aqui, PRD §51 mobile-first), e uma biblioteca dedicada
(ex.: `@dnd-kit`) seria uma dependência nova só para esta interação. Subir/
descer funciona igual em qualquer dispositivo, sem dependência nova, e
cumpre a FUNÇÃO pedida (reordenar) mesmo não sendo o MECANISMO literal do
texto. Revisitar com uma biblioteca de verdade se o uso real mostrar que
isso incomoda.

## D56 — Ícone de botão ganha id estável antes de existir na lista

**Data:** 30/09/2026 · **Etapa:** 12

O formulário de botão (`ButtonForm`) recebe um `id` de verdade
(`crypto.randomUUID()`) **antes** de o botão ser confirmado na lista —
tanto para criar quanto para editar. Sem isso, o upload de ícone (que
acontece enquanto o formulário ainda está aberto, antes de "salvar") não
teria um nome de arquivo estável: dois botões novos criados em momentos
diferentes escreveriam no mesmo caminho de Storage. Por isso
`inserirBotaoComId` foi criada — `adicionarBotao` (etapa 8) sempre gera um
id novo, o que descartaria esse id já usado no upload.

## D57 — Aviso de alterações pendentes cobre perda de digitação, não "falta publicar"

**Data:** 30/09/2026 · **Etapa:** 12

O PRD §19 fala em avisar sobre "alterações ainda não publicadas". Interpretei
como proteção contra perder o que está sendo digitado e ainda não foi nem
salvo como rascunho — é o único ponto onde existe risco real de PERDA de
dado (um rascunho já salvo não se perde ao sair, só continua sem publicar).
`beforeunload` do navegador dispara quando o conteúdo em edição diverge do
último rascunho confirmado como salvo — cobre fechar aba, atualizar página,
digitar outra URL. Não cobre navegação interna via `<Link>` (o App Router
não tem um gancho oficial e estável de "bloquear navegação" nesta versão) —
lacuna conhecida, registrada, não escondida.

## D58 — Server Actions do editor não testadas isoladamente fora do Next

**Data:** 30/09/2026 · **Etapa:** 12

`src/app/painel/editor/actions.ts` importa `images.ts`/`draft.ts`
(`server-only`), então não pode ser importado por um script solto — mesma
barreira já vista em etapas anteriores. As funções que ele CHAMA
(`saveDraft`, `publishCard`, `restoreDraft`, `uploadImagem`) já foram
testadas de ponta a ponta contra o projeto real nas etapas 7, 10 e 11 — os
wrappers em si têm 1-3 linhas cada, sem lógica nova além de repassar o
resultado. Risco residual aceito e registrado, não testado por script:
seria preciso simular uma sessão de navegador completa para exercitar o
caminho inteiro (Server Action de verdade, não a função que ela chama).

## D59 — Placeholder genérico em vez de campo vazio ao duplicar

**Data:** 30/09/2026 · **Etapa:** 13

O §55 pede reaproveitar "estrutura, organização, aparência" sem copiar dado
pessoal (nome, telefone, PIX, Wi-Fi, links, endereço). Mas a etapa 8 (D38) já
tinha decidido que nenhum botão fica "pela metade" — um botão presente no
array precisa ter os campos do seu tipo preenchidos, sempre. As duas regras
juntas significam que "copiar estrutura, esvaziar dado" não é uma opção
válida: um botão de telefone sem número não passa na validação.

Resolvido com `botaoPlaceholder`: cada tipo ganha um valor de exemplo óbvio
("(00) 00000-0000", "Nome da rede") em vez do dado real ou de um campo
vazio. O rascunho duplicado continua válido, e o texto do placeholder deixa
claro que precisa ser preenchido — a mesma função também vira o catálogo de
modelos fixos (§54), evitando duas implementações da mesma ideia.

## D60 — Modelos continuam sendo presets fixos no código (P6)

**Data:** 30/09/2026 · **Etapa:** 13

Reafirma a suposição da etapa 3: 3 modelos fixos em
`src/lib/card/templates.ts`, sem tela de gestão para o admin — o §35 não
lista isso entre as capacidades do painel administrativo. P6 segue aberta
para confirmação, mas deixa de bloquear qualquer coisa: a funcionalidade
está implementada e testada com essa leitura.

## D61 — Verificação real via réplica da sequência, não da função em si

**Data:** 30/09/2026 · **Etapa:** 13

`criarCliente()` é `server-only` (mesma barreira de sempre) e não pôde ser
chamada direto por um script. A lógica de maior risco real — vazar dado
pessoal na duplicação — já estava exaustivamente testada no nível da função
pura (D59, 15 verificações incluindo checar que telefone/CPF/SSID/senha do
original não aparecem no resultado). O que faltava confirmar era só se o
`INSERT` de verdade aceita esse conteúdo sob as `CHECK constraints` reais —
verificado replicando a MESMA sequência de chamadas que `criarCliente` faz
(buscar publicado, duplicar, inserir), usando a função real importada, contra
o projeto real. Não é o mesmo que testar a função `criarCliente` linha por
linha, mas cobre o caminho de dado de ponta a ponta.

## D62 — `next/image` com domínio do Storage derivado da URL do projeto

**Data:** 30/09/2026 · **Etapa:** 14

Trocado `<img>` por `next/image` nas três telas que exibem foto/banner
vindos do Storage (página pública, editor, pré-visualização) — otimização
automática de tamanho/formato por dispositivo, prioridade de performance
(§52) e mobile (NFC abre em internet do celular). `remotePatterns` não pode
ser hardcoded com o hostname do projeto: quebraria ao trocar de projeto
Supabase entre ambientes. Resolvido derivando o hostname de
`NEXT_PUBLIC_SUPABASE_URL` em `next.config.ts`, restrito ao caminho exato do
bucket `card-images`. Verificado com cliente de teste real (foto real no
Storage, build de produção real, requisição HTTP real ao endpoint
`/_next/image` — 200, `image/jpeg`), não só localmente.

## D63 — Correção de estouro horizontal em telas estreitas (editor de botões)

**Data:** 30/09/2026 · **Etapa:** 14

Auditoria de responsividade achou duas linhas do editor que não cabem em
larguras de telefone comuns (320–375px), por usarem `justify-between`/`flex
gap-2` sem quebra:

- cada botão da lista tinha 2 setas + rótulo à esquerda e 4 ações
  (Ativar/Editar/Duplicar/Excluir) à direita na mesma linha — a soma passa
  da largura disponível;
- a barra fixa de ações (Salvar rascunho/Publicar/Restaurar) tinha os 3
  botões numa única linha sem quebra.

Corrigido com `flex-wrap` na barra de ações e empilhamento
(`flex-col`→`sm:flex-row`) na linha de cada botão, mantendo o layout em
linha única a partir de `sm:`. Aproveitado para aumentar a área de toque das
setas ▲▼ (sem padding antes, texto de ~10px de alvo) para `p-1.5` com
`rounded` — ainda abaixo dos 44px recomendados, mas dentro do mínimo de
24px do WCAG 2.5.8 e consistente com os outros botões da lista (que já
usavam `py-1`/`py-1.5`). Resto do editor, painel do cliente, painel
administrativo e página pública já estavam adequados (containers
`max-w-sm`/`max-w-2xl`/`max-w-4xl`, `overflow-x-auto` na tabela do admin,
labels/`htmlFor` corretos, `:focus-visible`, `prefers-reduced-motion`,
`lang="pt-BR"`, zoom não travado no viewport) — nenhuma mudança adicional
foi necessária ali.

## D64 — Auditoria de segurança/RLS da etapa 15: achados e confirmações

**Data:** 30/09/2026 · **Etapa:** 15

Revisão sistemática de toda política de RLS, toda função `security
definer`/`invoker`, autenticação e segredos, contra a lista de armadilhas
conhecidas do Supabase (metadado de JWT inseguro, view sem
`security_invoker`, `UPDATE` sem `WITH CHECK`, `TO authenticated` sem
predicado de dono, `SECURITY DEFINER` público sem checagem, upload sem
SELECT+UPDATE para upsert). **Confirmado, não suposto:** `am_i_admin` nunca
usa `user_metadata`/`app_metadata` — o status de admin vem de
`private.admins`, uma tabela própria, não de claim de JWT; toda política de
`UPDATE`/`ALL` tem `USING` e `WITH CHECK`; nenhuma política usa
`TO authenticated` sem predicado de dono ou `private.is_admin()`; o
processamento de imagem (`sharp().rotate().webp()`, sem `.withMetadata()`)
já descarta EXIF/GPS da foto original como efeito colateral do pipeline
existente, não por decisão nova. Nada disso precisou de correção.

Dois achados reais, corrigidos nesta etapa — detalhados em D65 e D66 abaixo.

## D65 — `get_public_card` não normalizava maiúsculas/minúsculas

`username` só é gravado em minúsculas (CHECK constraint em `clients` +
`.toLowerCase()` em `criarCliente`), mas `get_public_card` comparava sem
`lower()` enquanto `username_exists` já usava — uma URL com alguma
maiúscula (comum em autocapitalização de teclado de celular, ou numa barra
de endereço) fazia um cartão ATIVO de verdade aparecer como "indisponível".
Corrigido normalizando com `lower()` em `get_public_card`
(migration `20260930180000`), igual ao que `username_exists` e
`resolve_login_identity` já faziam. Teste de regressão adicionado (seção 32 da suíte): cliente ativo com
username lowercase precisa aparecer mesmo quando `get_public_card` é
chamada com o argumento em maiúsculas.

## D66 — Exclusão de cliente deixava imagens órfãs no Storage

`delete_client` sempre apagou só as linhas do banco (`clients` e o que
cascateia por FK) — nunca tocou o bucket `card-images`. Como o Storage não
tem FK nem cascade do Postgres, as imagens do cliente excluído (foto,
banner, fundo, ícones de botão) ficavam no bucket para sempre, contrariando
tanto o §34 do PRD ("apagará permanentemente... todos os dados vinculados")
quanto o aviso mostrado ao próprio admin na tela de exclusão. Corrigido com
`removerTodasImagensDoCliente` (`src/lib/card/images.ts`) — lista e remove
tudo sob `{clientId}/` — chamada por `excluirAction` logo após o
`delete_client` ter sucesso, usando a sessão do admin autenticado (a
política `card_images_admin_all` já cobre isso; sem necessidade da chave de
serviço). Best-effort deliberado: a exclusão da conta já é irreversível
antes desta chamada, então uma falha aqui não é revertida nem re-tentada —
na pior hipótese deixa uma imagem órfã para limpeza manual, nunca desfaz a
exclusão da conta.

Verificado com um cliente de teste real (3 imagens de verdade enviadas ao
bucket) e um administrador de teste descartável com sessão autenticada de
verdade (não a chave de serviço) — para provar que a política de RLS
`card_images_admin_all` realmente autoriza `list()`/`remove()` na pasta de
outro usuário, não só em teoria. As 3 imagens desapareceram do bucket
(confirmado por uma segunda consulta com a chave de serviço, que bypassa
RLS). Cliente e admin de teste removidos ao final.

**Residual aceito, não corrigido:** a linha em `auth.users` do cliente
excluído sobrevive (Storage e `clients` não têm FK/cascade até `auth.users`
na direção `clients -> auth.users`). Não contém dado pessoal real — o
e-mail é sintético (`{username}@internal.cartao.local`) e o username já fica
retido para sempre em `reserved_usernames` por decisão da etapa 3 (P2) — só
mantém uma conta de Auth inerte. Fora do escopo desta etapa: exigiria a
chave de serviço dentro de uma Server Action acionável pelo admin, uma
superfície nova, para remover algo que já não é dado pessoal.

## D67 — `username_exists` não reconhecia cliente excluído (PRD §39 vs §40)

**Data:** 30/09/2026 · **Etapa:** 16

O usuário reenviou o texto do PRD nesta etapa (a versão usada desde o início
da conversa tinha uma numeração de seções diferente, perdida na compactação
do histórico — esta é a fonte de verdade agora). Lendo o §39 ("Página 404":
username nunca usado → 404 de verdade) contra o §40 ("URLs de cartões
excluídos": NÃO pode gerar erro do sistema, precisa da mesma página neutra
de vencido/cancelado), ficou claro que a implementação da etapa 9 conflava
os dois casos.

`username_exists` só consultava `public.clients`. Depois que `delete_client`
remove a linha de lá, a função responde `false` tanto para um username
nunca usado quanto para um recém-excluído — e a página pública usa esse
`false` para decidir `notFound()`. Resultado: um cartão excluído caía em
404 ("não foi encontrado"), quando o PRD pede a página neutra ("não está
disponível"), a mesma dos status vencido/cancelado.

A própria `reserved_usernames` (etapa 3, P2) já registra a distinção certa:
toda exclusão grava `reason = 'deleted_client'`, e só exclusão grava esse
motivo (o outro valor, `'system'`, é a lista fixa de palavras reservadas,
que devem continuar caindo em 404 se não tiverem rota própria). Corrigido
somando essa checagem a `username_exists` (migration `20260930190000`).
Também corrigido um teste da suíte que **afirmava o comportamento antigo
(errado) como esperado** — `existe = false` para cliente excluído — agora
ajustado para `existe = true`, mais um caso novo cobrindo que uma palavra
reservada do sistema (não excluída) continua `false`.

Verificado em produção com um cliente de teste real: `username_exists`
antes da exclusão (true) → depois da exclusão (agora true, era false) →
username nunca usado (false, inalterado).

## D68 — Etapa 16: ciclo de vida completo testado numa única execução encadeada

**Data:** 30/09/2026 · **Etapa:** 16

Até aqui, cada etapa testou sua própria fatia isoladamente (212+ verificações
no PGlite, mais scripts de E2E pontuais por etapa). O que faltava era provar
que a SEQUÊNCIA completa — cadastro → login → edição → publicação → NFC →
renovação → vencimento → cancelamento automático → exclusão — funciona
encadeada, contra o projeto real, sem reiniciar estado entre passos (o tipo
de bug que testes isolados não pegam: um passo que deixa o banco num
estado que quebra o próximo).

Rodado um script descartável (apagado ao final) contra produção, cobrindo
12 dos 13 itens do §53 ("Critério de sucesso") em ordem — o item 3
("gravar a URL num NFC físico") é manual, fora do alcance de software:

1. cadastro (replicando exatamente a sequência de `criarCliente`);
2. URL previsível a partir do username;
4. login real (usuário/senha, via `resolve_login_identity` +
   `check_login_lock`/`register_login_success`, como `tentarLogin` faz);
5. personalização com um botão de CADA um dos 6 tipos (link, texto, wifi,
   pix, telefone, endereço) — cobre também o item 8;
6. publicação (`publish_card`);
7. leitura pública (`get_public_card`) com todos os 6 tipos de botão
   chegando intactos, campo por campo (url, ssid+password, chave PIX...);
9. renovação pelo admin — confirmado que o período é SOMADO ao vencimento
   atual quando o cliente está ativo (§16), não recontado do zero;
10. vencimento: status muda para `expired` sozinho (sem job), o visitante
    deixa de ver o cartão, o cliente AINDA acessa o painel (lê o rascunho)
    mas não consegue mais salvar — travado no banco, testado com um UPDATE
    de verdade que retorna 0 linhas, não só escondido na tela;
11. cancelamento automático após 15 dias vencido: status vira `cancelled`
    sozinho, sem nenhuma ação do admin (`cancelled_at` continua nulo) —
    confirma que `effective_status()` (D-original da etapa 3) cobre esse
    caso sem cron job, como pretendido;
12. exclusão pelo admin, só permitida com o status (derivado) `cancelled`;
13. atualizado o conteúdo publicado duas vezes sob a MESMA URL, confirmando
    o princípio central do §54 ("o NFC nunca depende do conteúdo").

Resultado: 28/28 verificações, numa única execução. Também confirmados por
leitura de código (sem necessidade de novo teste, já cobertos em etapas
anteriores): `src/app/loading.tsx`/`error.tsx` existem (§38), metadados
Open Graph presentes em `generateMetadata` (§41).

**Pendência fora do alcance de código:** §45 pede rotina de backup do
banco. Isto é configuração de infraestrutura do projeto Supabase (backups
automáticos/PITR), não algo que se implemente em `src/` ou em migration —
fica como item de checklist para o usuário confirmar no painel do Supabase
antes do deploy (etapa 17), não uma pendência de desenvolvimento.

## D69 — Tipo de botão "Telefone" aposentado; número vai para o "Salvar Contato"

**Data:** 04/10/2026 · **Etapa:** ajustes pós-etapa 16

**Conflito com o PRD, decidido pelo usuário:** o PRD §13.5 define
"Telefone" como um dos 6 tipos de botão. O usuário decidiu removê-lo, por
ser redundante com o botão "Salvar Contato", que passou a ter um número
próprio. Pela hierarquia do projeto (instrução do usuário acima do PRD), a
decisão vale; o PRD não foi alterado e continua listando o tipo.

O que mudou:

1. **Campo novo `contactPhone`** no conteúdo do cartão: o número que o
   "Salvar Contato" grava no vCard, editado no bloco "Links do cartão"
   (entre "Redes e contatos" e "Links principais", a mesma posição do botão
   no cartão). Aceita só dígitos, espaço e `+ ( ) - .`, até 30 caracteres;
   vazio vale como ausente, para o salvamento automático não falhar
   enquanto o número é digitado. Validado no servidor
   (`validarConteudoCartao`) e no banco (migration `20261004120000`,
   `validate_card_contact_phone`), com teste de paridade TS × SQL. No vCard
   vem primeiro; o mesmo número escrito de outro jeito não se repete. É dado
   pessoal: a duplicação de cartão não o copia (§55).
2. **Tipo "Telefone" sai da criação** (`TIPOS_PARA_CRIAR`), dos modelos
   prontos ("Clássico": link, texto, endereço; "Colorido": link, texto,
   Wi-Fi) e da duplicação de cartão.
3. **Ícone "Telefone" sai do seletor** (`retired` no catálogo de ícones).

**Compatibilidade, sem apagar dados:** o tipo continua aceito pelo banco
(`validate_button`) e pelo app (`TIPOS_DE_BOTAO`); botões de telefone já
salvos continuam no cartão, editáveis, e o número deles ainda entra no
vCard. A chave de ícone `phone` continua desenhando para quem já a usa.
Converter os botões antigos em `contactPhone` e removê-los fica como
opção, só com autorização, porque altera dados de clientes.

**Pendência de banco:** ao preparar a aplicação da migration
`20261004120000_card_contact_phone.sql`, verificou-se no projeto Supabase
que `20261003150000_card_profession.sql` e
`20261003190000_card_accent_color.sql` também não estão aplicadas (as
constraints não existem). Até serem aplicadas, essas três regras valem só
no servidor do app, não no banco.

## D70 — "Salvar Contato" grava só nome e telefone

**Data:** 04/10/2026 · **Etapa:** ajustes pós-etapa 16

Decisão do usuário: o objetivo do botão é salvar o número de telefone na
agenda do visitante. O vCard deixou de levar profissão (`TITLE`),
descrição (`NOTE`), endereços (`ADR`) e links (`URL`); fica só o nome
(`FN`/`N`, sem ele o contato não serve na agenda) e o telefone (`TEL`) —
o `contactPhone` primeiro e, depois, botões de telefone antigos (D69).

Consequência: sem nome **ou** sem telefone, `getContactCardData` devolve
`null` e o botão "Salvar Contato" não aparece no cartão nem na prévia.
Antes ele aparecia sempre que havia nome, mesmo sem número.

## D71 — Rodapé do sistema em todos os cartões, editado só pelo administrador

**Data:** 04/10/2026 · **Etapa:** ajustes pós-etapa 16

Pedido do usuário: um bloco "Precisa de uma solução digital? / Solicitar
serviço" no fim de todos os cartões, que o cliente não altera nem remove,
com um espaço no painel do administrador para ajustá-lo.

- **Fora do conteúdo do cartão.** O cliente grava o JSON do cartão; por
  isso o rodapé mora numa tabela própria, `card_footer_settings`, de uma
  linha só (chave `boolean` que só aceita `true`). Migration
  `20261004130000_card_footer.sql`.
- **Acesso no mesmo modelo do schema:** anon e cliente não têm privilégio
  na tabela; leem por `get_card_footer()` (`security definer`), que devolve
  só os campos exibidos, e nada quando o rodapé está desativado. Só o
  administrador lê e altera a linha (políticas com `private.is_admin()`).
  `check` no banco: título 1–60, subtítulo até 120, texto do botão 1–30,
  link só `http(s)` até 500 — espelhados em `validarRodape`.
- **Só no cartão ativo.** É lido depois de `getPublicCard` confirmar o
  cartão; a página neutra (vencido/cancelado) não mostra nada (regra 4).
  Aparece também na prévia do editor, para o cliente saber que existe.
- **Falha de leitura mantém o texto padrão** (`RODAPE_PADRAO`, igual ao
  semeado na migration), para o rodapé não sumir por um erro passageiro.
- **Painel:** `/admin/rodape` ("Rodapé dos cartões" no menu), com
  ativar/desativar, título, subtítulo, texto e link do botão, e amostra.
- **Destino padrão:** WhatsApp do administrador (`wa.me/5596981233398`,
  o mesmo número de renovação), alterável no painel.

Pendência: a migration ainda não foi aplicada no Supabase (ver D69).
*(Resolvida em 04/10/2026: as migrations de 03/10 e 04/10 foram aplicadas.)*

## D72 — Balão de suporte no editor, com pedidos no painel do administrador

**Data:** 04/10/2026 · **Etapa:** ajustes pós-etapa 16

Pedido do usuário: um balão no canto do editor para o cliente reportar um
erro (o que tentava fazer + qual erro deu) ou pedir ajuda (o que quer).
Destino escolhido pelo usuário: ficar salvo no sistema e aparecer no painel
do administrador (alternativas descartadas: só WhatsApp; os dois).

- Tabela `support_requests` (migration `20261004140000`). O cliente só
  **insere**, e só em nome próprio (`client_id = auth.uid()` na política;
  o id vem da sessão, nunca do navegador). Não lê nem altera nada, nem os
  próprios pedidos. O administrador lê e muda o status (aberto/resolvido).
- `check` no banco: tipo `error`/`help`; textos de 1 a 1000 caracteres
  (sem aceitar só espaços); texto do erro obrigatório no erro e proibido na
  ajuda; `resolved_at` só (e sempre) quando resolvido.
- Limite de 5 envios por cliente por hora, na própria política de insert,
  contado por `private.support_requests_last_hour` (`security definer`,
  porque o cliente não enxerga as próprias linhas).
- Balão fixo no canto inferior direito do editor; no celular sobe para
  ficar acima da barra "Publicar alterações". Formulário em `<dialog>`.
- Painel: `/admin/suporte` ("Suporte" no menu), abas Abertos/Resolvidos,
  link para o cliente, texto exibido como texto puro.

## D73 — Painel administrativo como central de operação dos cartões

**Data:** 04/10/2026 · **Etapa:** ajustes pós-etapa 16

Pedido do usuário (12 etapas). Migrations `20261004150000` a
`20261004200000`, todas aplicadas no Supabase.

1. **Exclusão só após 3 meses cancelado** — mais restrito que o PRD
   §34/§66 ("somente cancelados"), por decisão do usuário. Data do
   cancelamento = `cancelled_at` (manual) ou `expires_at + 15 dias`
   (automático, a mesma regra de `effective_status`). A trava está na
   política de delete de `clients` (vale até para DELETE direto) e em
   `delete_client`. A exclusão agora também apaga a conta de login
   (`auth.users`), que antes ficava para trás — depois do `delete_client`,
   nunca antes (a cascata passaria por cima da regra).
2. **Estado do cartão** (`admin_client_overview`): Atualizado / Alterações
   não publicadas / Nunca publicado, comparando o **conteúdo** do rascunho
   com o publicado — divergência consciente do pedido, que sugeria comparar
   `updated_at` com `published_at`: "Descartar alterações" e o salvamento
   automático regravam o rascunho sem mudá-lo e a comparação por data
   acusaria pendência falsa. O painel do cliente passou a usar a mesma regra.
3. **Publicado × Rascunho** na ficha, com o mesmo `DigitalCard`.
4. **Edição pelo admin** com o mesmo `CardEditor`: as ações (salvar,
   publicar, descartar, enviar imagem) viraram injetáveis (`EditorActions`);
   o padrão continua sendo o cliente. Sem impersonação. Funções
   `admin_save_draft`/`admin_publish_card`/`admin_restore_draft` conferem
   `private.is_admin()`; o upload aceita pasta de outro cliente só para
   admin e só com UUID. O admin publica mesmo com o cliente inativo (a
   página pública segue neutra). Edição simultânea admin × cliente: vale a
   última gravação (aviso na tela).
5. **Auditoria** sem conteúdo do cartão nem dado pessoal nos detalhes:
   novas ações `card_draft_saved` (no máximo uma por admin/cliente a cada
   30 min, porque o editor salva sozinho), `card_published`,
   `card_draft_discarded`, `contacts_updated`, `payment_recorded`.
6. **Saúde do cartão** — regras em `lib/admin/card-health.ts`.
7. **Contato administrativo** (`client_admin_contacts`): WhatsApp e e-mail,
   opcionais, só admin; finalidade: falar com o cliente sobre renovação e
   suporte. Fora de `clients` porque o cliente lê a própria linha de lá.
8. **Precisam de atenção** na home (`admin_attention_counts`, uma consulta).
9. **Filtros** principais + "Mais filtros"; busca também por WhatsApp e
   e-mail internos. Filtros de estado do cartão ignoram clientes
   cancelados. `%` e `_` digitados são texto.
10. **Pagamentos** (`client_payments`): registro opcional e imutável ao
    renovar, na mesma transação (`renew_client_with_payment`).
11. **Suporte**: classificação (Erro/Dúvida/Alteração/Financeiro),
    prioridade (Normal/Alta) e anotação interna, só pelo admin; atalhos
    para cliente, cartão e editor.
12. **Analytics**: não implementado. Nada criado impede métricas agregadas
    futuras (tabela própria por evento/dia, sem dado do visitante).

Operação: a ferramenta de migrations do Supabase recusa `DROP POLICY`,
`DROP TRIGGER` e `DROP FUNCTION`; as migrations usam `ALTER POLICY` e não
removem `list_clients_for_admin` (sem uso, pendente de remoção manual).
Pagamentos são apagados junto com o cliente (cascade): se houver obrigação
fiscal de guardar esses registros, a regra precisa de validação.
