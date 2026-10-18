# Recuperação do administrador com MFA

Este procedimento é para a conta administrativa quando o autenticador TOTP
foi perdido e não existe outro administrador ativo. Ele exige controle do
projeto `Cartao de Visita` no Supabase; conhecer apenas o username não permite
remover um fator.

1. Confirme no painel do Supabase que o projeto é `eabefggjiybpvucpvcxv`.
2. Abra **Authentication → Users** e localize a conta administrativa pelo ID
   e e-mail interno conhecidos. Não use apenas o nome exibido na aplicação.
3. Abra os fatores MFA da conta e remova somente o fator TOTP perdido.
4. Se a senha também foi perdida, defina uma senha temporária forte pela função
   administrativa do provedor. Não envie a senha por e-mail ou WhatsApp.
5. Entre novamente no sistema. A tela `/mfa` exigirá o cadastro de um novo
   autenticador antes de liberar a administração.
6. Confirme que a sessão chegou a `aal2`, encerre outras sessões e registre a
   recuperação no controle operacional, sem anotar senha, segredo TOTP ou QR
   Code.

Antes de exigir MFA no banco de produção, mantenha acesso confirmado ao painel
do Supabase e teste este procedimento em ambiente isolado. O sistema não cria
códigos de recuperação próprios e não oferece remoção de fator verificado em
uma sessão `aal1`.
