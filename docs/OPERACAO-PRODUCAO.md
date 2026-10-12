# Operação de produção

## Separação de ambientes

Mantenha projetos Supabase distintos para desenvolvimento, preview e produção. Nunca copie a chave secreta de produção para preview. Configure na Vercel as variáveis por ambiente e confirme que `NEXT_PUBLIC_SITE_URL` aponta ao domínio canônico de produção; quando omitida ou local, a aplicação usa `VERCEL_PROJECT_PRODUCTION_URL`.

## Backup e migrações

Antes de aplicar migrations, gere e verifique um backup restaurável do Postgres e uma cópia do bucket `card-images`. Registre a versão implantada e a lista de migrations pendentes. Aplique-as em ordem, primeiro em preview. A migration `20261010160000_private_card_images.sql` altera o bucket para privado e converte referências públicas existentes; rode também `scripts/create-storage-bucket.mjs` para conferir a configuração pela API.

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
