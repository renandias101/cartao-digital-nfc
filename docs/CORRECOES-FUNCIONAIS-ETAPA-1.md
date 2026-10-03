# Correções funcionais — etapa 1 (03/10/2026)

## Escopo e andamento

Primeira etapa da solicitação de correções funcionais, conforme a regra do
AGENTS.md de validar, relatar e parar para autorização entre etapas.
A rodada completa **não está concluída**. Nenhum deploy, commit, migration,
exclusão de arquivos do usuário ou alteração de dados reais foi realizado.

## Diagnóstico e mudanças

- **Adicionar/duplicar botão:** `crypto.randomUUID()` não está disponível
  no acesso HTTP pela LAN. O teste reproduziu `TypeError` antes da correção.
  Agora ambos usam UUID v4 com `crypto.getRandomValues()` como alternativa,
  sem aleatoriedade fraca. Mantidos os seis tipos e o limite de dez botões.
- **Formulário de botão:** podia aparecer fora da região visível, e trocar
  o botão em edição reaproveitava estado do anterior. Agora recebe chave
  pelo identificador, rolagem para ficar visível e foco no primeiro campo.
- **Upload:** o limite documentado do Next era 1 MB, incompatível com os
  5 MB aceitos pelo produto. Transporte ajustado para 6 MB com margem
  multipart; a validação do arquivo permanece em 5 MB. MIME/tamanho são
  verificados antes do envio; o servidor continua decodificando os bytes
  com sharp e reconvertendo em WebP. Propósito também é validado em runtime.
- **Erros:** rejeições de rede/transporte eram propagadas sem tratamento.
  Upload, salvar, publicar e restaurar agora apresentam erro sem derrubar
  o editor. Upload malsucedido conserva a imagem anterior e permite retry.
- **Imagem publicada:** nome fixo e `upsert: true` sobrescreviam a imagem
  publicada durante edição do rascunho. Cada upload agora ganha URL única,
  `upsert: false`, na pasta do usuário autenticado. URLs antigas permanecem
  intactas. D49 foi documentada como substituída. Versões sem referência
  podem acumular no Storage; sua limpeza fica fora desta etapa.

## Ver meu cartão — investigação ainda pendente

Os links existentes no painel e no editor já apontam para `/{username}`,
abrem outra aba e não têm atributo disabled. A função pública consulta
apenas `card_published` de cliente ativo; um cartão sem publicação retorna
a tela neutra, por regra. No editor, falhas na consulta de status/username
podem esconder o link sem explicar o erro. **Não há evidência suficiente
para atribuir a indisponibilidade relatada a uma dessas condições.**
Não foi criada outra rota nem exposto o rascunho ao visitante.

## Testes

| Verificação | Resultado |
| --- | --- |
| Regressões antes do ajuste | 2 falhas reproduzidas: UUID e limite de transporte |
| `npm run test:editor` | 5 testes aprovados |
| `npm run test:rls` | 215 verificações aprovadas, em PGlite temporário |
| `npm run typecheck` | Aprovado |
| `npm run lint` | Aprovado |
| `npm run build` | Aprovado; nenhuma rota nova |
| `npm run test:editor:browser` | Chrome, 1440×900 e 390×844; componentes reais com actions simuladas |

No navegador foram verificados: ausência de `randomUUID`, formulário
visível/focado, adicionar, duplicar, trocar entre botões em edição,
salvar, excluir, falha de upload sem crash, retry, foto/banner/fundo/ícone,
rejeição de SVG e ausência de overflow horizontal. Não foi instalada
dependência: a fixture reutiliza esbuild já disponível pelo tsx e Chrome.
Execute o build antes do teste de navegador; `CHROME_PATH` permite indicar
outra instalação. Uma instalação sem Chrome pula esse teste explicitamente.

Limites: actions simuladas não comprovam conectividade, configuração do
bucket ou permissões do Supabase real. A suíte PGlite não inclui políticas
de Storage. Publicação real, abertura do cartão autenticado/publicado e
comportamento dos novos recursos pendentes ainda precisam ser verificados.

## Arquivos

- `next.config.ts`: limite de transporte.
- `src/lib/card/button-id.ts`, `buttons.ts`: identificadores compatíveis com LAN.
- `src/lib/card/image-upload.ts`, `images.ts`: validação e URLs versionadas.
- `src/app/painel/editor/{card-editor,button-form,image-field}.tsx`: interação e erros.
- `src/app/painel/editor/actions.ts`: proteção da ação de upload.
- `tests/editor-regressions.test.ts`, `tests/editor-browser.test.mjs`, `package.json`: testes.
- `docs/DECISOES-TECNICAS.md`: revisão da decisão D49.
- Este relatório.

## Framework e skills

Consultados o framework local e suas orientações para correção de bugs,
segurança e conclusão, além do AGENTS.md e da documentação local do Next.
Skills aplicadas: `bug-reproduction` (reproduzir antes de corrigir e manter
regressões) e `react-best-practices` (estado e eventos dos componentes).
Prioridades respeitadas: mudanças pequenas, sem dependências novas,
autorização baseada na sessão, preservação do publicado e compatibilidade.
Não houve redesenho nem remoção de funcionalidades existentes; mudanças
visuais limitadas ao foco/rolagem do formulário e mensagens de erro.

## Próxima etapa, mediante autorização

Investigar e tratar “Ver meu cartão” com evidência do ambiente real;
adicionar cor do texto; implementar autosave de rascunho e recuperação;
adicionar recorte/zoom/reposicionamento antes do upload; completar os
testes integrados de retorno ao editor, descarte, publicação e página pública.
O rascunho continua sendo salvo **manualmente** em `card_drafts` e lido ao
abrir o editor. Autosave e recorte não foram implementados nesta etapa.
