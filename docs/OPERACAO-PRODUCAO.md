# Operação de produção

## Separação de ambientes

Mantenha projetos Supabase distintos para desenvolvimento, preview e produção. Nunca copie a chave secreta de produção para preview. Configure na Vercel as variáveis por ambiente e confirme que `NEXT_PUBLIC_SITE_URL` aponta ao domínio canônico de produção; quando omitida ou local, a aplicação usa `VERCEL_PROJECT_PRODUCTION_URL`.

## Backup e migrações

Antes de aplicar migrations, gere e verifique um backup restaurável do Postgres e uma cópia do bucket `card-images`. Registre a versão implantada e a lista de migrations pendentes. Aplique-as em ordem, primeiro em preview. A migration `20261010160000_private_card_images.sql` altera o bucket para privado e converte referências públicas existentes; rode também `scripts/create-storage-bucket.mjs` para conferir a configuração pela API.

Para projeto Supabase gratuito, faça exportação lógica regular com `supabase db dump` e mantenha a cópia fora do projeto. Backups do banco não incluem os arquivos do Storage: o bucket privado `card-images` precisa de cópia separada. Em plano pago, confirme em **Database → Backups** a existência e a janela das cópias automáticas.

Uma cópia só é considerada válida depois de um teste de restauração em projeto separado. O teste deve confirmar usuários do Auth, migrations, RLS, cartões publicados e arquivos privados, sem apontar a aplicação de produção para o projeto restaurado.

Registro mínimo de cada exercício: data, responsável, origem, destino isolado, último dado recuperado, arquivos conferidos, tempo de restauração e resultado. Nunca versione senha do banco, token de acesso ou dump com dados reais.

## Autenticação administrativa e MFA

O cadastro público do Supabase deve permanecer desativado; clientes são criados somente pela rotina administrativa. A senha mínima é de oito caracteres e a troca pelo cliente exige reautenticação.

MFA TOTP deve ser habilitado em **Authentication → Multi-Factor Authentication** antes de exigir segundo fator no sistema. A exigência completa depende de duas telas: cadastro do aplicativo autenticador e desafio após o login. Não force `aal2` somente no banco antes dessas telas existirem, pois isso bloqueia o único administrador.

Ao ativar MFA, cadastre primeiro o administrador `renandias101`, confirme uma sessão `aal2`, guarde os meios de recuperação em local seguro e teste o procedimento de recuperação administrativa já descrito neste documento.

## Monitoramento e resposta a incidente

O endpoint público `GET /api/health` verifica a aplicação e uma leitura pública mínima do banco. Ele retorna somente `{"status":"ok"}` ou `{"status":"unavailable"}`, sem versão, credenciais ou detalhes internos, e nunca deve ser armazenado em cache.

Configure na plataforma de monitoramento uma consulta HTTPS a cada cinco minutos e alerte após duas falhas consecutivas. A URL recomendada é `https://SEU-DOMINIO/api/health`. Na Vercel, acompanhe também erros 5xx e falhas das funções; no Supabase, acompanhe Auth, banco e Storage.

Em incidente: preserve evidências sem copiar senhas ou chaves para chamados, revogue credenciais comprometidas, contenha o acesso, avalie dados e titulares afetados, restaure apenas de cópia validada e registre causa, impacto, decisão e correção. Não restaure produção para investigar quando um projeto isolado puder ser usado.

## Validação hospedada

- Confirmar políticas RLS, Auth e Storage no projeto correto.
- Testar cliente ativo, vencido, cancelado e URL de cliente excluído.
- Testar URL atual e dois aliases antigos, login pelo nome atual e recusa do alias no login.
- Testar imagem de quase 5 MB, interrupção e repetição do envio, rascunho anônimo, publicação e revogação após cancelamento.
- Conferir proteção contra senhas vazadas no Supabase Auth e a política de sessão/MFA administrativa.

## Recuperação da senha do administrador

O fluxo público de “Esqueci a senha” cria pedidos somente para clientes ativos; ele não redefine contas administrativas. Se um administrador perder o acesso, outro administrador ativo deve redefinir sua senha pelo provedor de autenticação. Quando não houver outro administrador ativo, o responsável autorizado pelo projeto deve abrir **Supabase Dashboard → Authentication → Users**, localizar a conta administrativa pelo e-mail sintético já cadastrado e definir uma nova senha. Não criar outro usuário, não alterar o `id` da conta e não remover sua linha em `private.admins`, pois esses dados preservam identidade, permissões e histórico.

Depois da recuperação, entrar pelo nome de usuário administrativo atual e confirmar o acesso ao painel. A senha temporária deve ser entregue por canal seguro e nunca registrada em chamado, observação, log ou histórico.
- Executar build e smoke test no preview antes de promover.

## Rollback

Não reverta apenas o código se migrations já estiverem em uso. Interrompa tráfego ou novas gravações, restaure banco e Storage do mesmo ponto no tempo e publique a versão de aplicação correspondente. Se a falha estiver limitada ao deploy, reverta pela Vercel sem alterar o banco. Registre imagens pendentes e falhas de Auth/Storage para repetição segura pelas rotinas administrativas.

## Privacidade, retenção e direitos do titular

O aviso público fica em `/privacidade`. O responsável pelo tratamento é **Renan Monteiro Dias**, pessoa física, e o canal informado aos titulares é o WhatsApp **(96) 98123-3398**. Em produção, `NEXT_PUBLIC_WHATSAPP_RENOVACAO` deve permanecer configurada como `5596981233398` para o link internacional funcionar.

Rotina operacional mensal:

1. revisar clientes cancelados que já completaram três meses e excluir os que não tenham obrigação pendente;
2. encerrar pedidos de senha e suporte já atendidos, sem registrar senha ou conteúdo desnecessário;
3. revisar a necessidade dos registros administrativos e financeiros antes de qualquer expurgo;
4. registrar solicitações de acesso, correção, portabilidade ou exclusão, validar a identidade por canal seguro e responder ao titular;
5. quando houver exclusão, explicar que cópias de segurança permanecem inacessíveis à operação normal até o fim do ciclo do provedor.

Pedidos de titulares não autorizam entregar dados a quem conhece apenas o nome de usuário. A administração deve confirmar a identidade usando os contatos internos já cadastrados. Incidentes ou suspeitas de acesso indevido devem ser registrados, contidos e avaliados antes de comunicar o titular ou a autoridade competente.
