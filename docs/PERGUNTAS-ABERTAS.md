# Perguntas abertas

Pontos do PRD que ainda não têm resposta. O framework proíbe inventar
requisito para preencher lacuna (Fluxo Novo Projeto 4). Cada item registra a
etapa que fica bloqueada e a suposição provisória, quando existir.

## Bloqueiam a etapa 3 (banco de dados)

### P1 — Quais campos tem o cadastro do cliente?

O PRD §60 cita apenas nome de usuário, senha e pacote, mas o §37 exige busca
**por nome**, o que implica um "nome do cliente" distinto do nome exibido no
cartão. Faltam definir: nome do cliente, telefone de contato, e-mail — quais
existem e quais são obrigatórios. Impacto: define a tabela de clientes e o que
a LGPD considera dado coletado.

### P2 — Username de cliente excluído pode ser reutilizado?

Se puder, um cartão NFC antigo em circulação passa a abrir o cartão de outra
pessoa. Recomendação: reservar o slug permanentemente. Impacto: exige tabela de
slugs reservados.

### P3 — O administrador pode cancelar um cliente ATIVO diretamente?

O §35 lista "cancelar" como ação e o §33 exige status CANCELADO para excluir,
o que sugere que sim. O §26 só descreve o cancelamento automático após 15 dias.
Se puder: a data de vencimento é preservada ou zerada?

### P4 — Momento exato do vencimento e aritmética de meses

Vence no início ou no fim do dia do vencimento? Fuso de Macapá (UTC−3, sem
horário de verão). E em renovação com dia inexistente — 30/11 + 3 meses cai em
28/02 — ajustar para o último dia do mês? Suposição provisória: vence no fim do
dia e o dia é ajustado para o último dia do mês quando não existir.

## P5 — resolvida na etapa 11 (ainda reversível)

**O que o cliente VENCIDO ou CANCELADO pode fazer no painel?** Implementado:
painel somente leitura — vê status, vencimento, URL pública, histórico —
mas edição do rascunho e publicação ficam bloqueadas **no próprio banco**
(RLS + checagem em `publish_card`/`restore_draft`), não só escondendo botão
na tela. Testado com clientes vencido e cancelado reais (D53). Continua
sendo interpretação, não certeza do texto do PRD — reversível bastando
ajustar a política e as duas funções na migration correspondente.

## P6 — resolvida na etapa 13 (ainda reversível)

**Modelos são presets fixos ou gerenciáveis pelo admin?** Implementado: 3
presets fixos no código (`src/lib/card/templates.ts`), sem tela de gestão —
o §35 não lista isso entre as capacidades do painel administrativo.
Duplicação (§55) também implementada: copia cores e estrutura de botões,
nunca dado pessoal (testado com 15 verificações, incluindo confirmar que
telefone/CPF/SSID/senha do original não aparecem no resultado). Reversível:
se o admin precisar criar/editar modelos, isso vira uma tabela + CRUD, sem
afetar a duplicação.

## Conflitos framework × PRD aguardando confirmação

### C1 — Retenção de dados de cliente cancelado

LGPD 33-35 pede prazo de retenção; o PRD §26/§33 mantém o cancelado
indefinidamente até o admin excluir. Segue o PRD. Mitigação proposta sem
alterar o produto: exibir "cancelado há X dias" no painel do admin.

### C2 — Exclusão irreversível × registro de auditoria

O §34 apaga "todos os dados vinculados"; o §40 exige registrar a exclusão.
Proposta: o log guarda o mínimo (username e nome no momento da exclusão) e
sobrevive à remoção da conta. Backups já realizados não são alcançados pela
exclusão.

### C3 — Senha inicial conhecida pelo administrador

O §60 exige que o admin defina a senha inicial; Seguranca 68-71 (menor
privilégio) recomenda o contrário. Segue o PRD. Mitigação possível, que seria
mudança de produto e não foi aplicada: forçar troca no primeiro login.

### C4 — Ausência de política de privacidade

LGPD 15 a sugere conforme o tipo de aplicação; o PRD não prevê a página. Não
foi criada, por respeito ao escopo (§59). Pendência de conformidade.

## Bloqueiam a etapa 9 (página pública)

### P7 — O que deve existir na raiz `/` do site?

O PRD especifica `/{usuario}` para o cartão público (§6) e as áreas de painel,
mas não define o conteúdo de `/`. Opções: página institucional do serviço,
redirecionamento para `/login`, ou uma página neutra. Hoje há um placeholder
neutro. Impacto: baixo, mas precisa de definição antes do deploy.

---

# Situação após a etapa 3

Em 29/09/2026 a instrução foi para continuar sem as respostas. P1 a P4 foram
então implementadas com o padrão mais seguro e reversível, e **seguem abertas
para confirmação** — cada uma é barata de trocar:

| Pergunta | Implementado | Como reverter |
|---|---|---|
| P1 | Só `full_name`; sem telefone nem e-mail | Migration acrescentando coluna anulável |
| P2 | Slug de excluído reservado para sempre (gatilho + tabela) | Remover a linha de `reserved_usernames` |
| P3 | Admin cancela de qualquer status; `expires_at` preservado | Regra fica na etapa 5, não no schema |
| P4 | Fim do dia em `America/Belem` (UTC-3 fixo) + ajuste de mês via aritmética nativa do Postgres | Trocar `p_package_months`/janela em `compute_new_expiry` |

**P3 e P4 foram completadas e testadas na etapa 5** (94 verificações),
deixando de ser só suposição:
- `cancel_client`: cancela de qualquer status, preserva `expires_at`, idempotente.
- `compute_new_expiry`: soma meses ao vencimento atual se ativo (§30), conta a
  partir de agora se vencido/cancelado (§31), fuso `America/Belem` confirmado
  sem horário de verão, fim de mês ajustado pela própria aritmética do
  Postgres (testado, não suposto — ver D23/D24).
- `delete_client` + política de RLS: exclusão travada a CANCELADO **no
  próprio banco**, não só na função (§66) — testado com DELETE cru.

C2 (exclusão irreversível × auditoria) foi resolvido como proposto e **está
testado**: o registro sobrevive com `client_id` nulo e snapshot do username,
inclusive quando a exclusão acontece por fora da aplicação (gatilho, não só
dentro da função).

P6 e P7 seguem abertas e ainda não bloqueiam nada implementado.
