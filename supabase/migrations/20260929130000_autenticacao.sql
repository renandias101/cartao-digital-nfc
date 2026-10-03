-- ============================================================================
-- Autenticação: identidade do administrador e bloqueio por tentativas
--
-- O Supabase Auth não tem bloqueio nativo por conta após N tentativas — só
-- rate limit por IP em endpoints específicos (confirmado na documentação
-- oficial, não por suposição). `private.login_throttle` supre essa lacuna.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Nome de usuário do administrador.
--
-- Guardado aqui, não em `clients`, porque o admin não é cliente e não tem
-- cartão. É o que permite resolver "username digitado no login" -> e-mail
-- sintético -> `auth.users`, para os dois papéis, pela mesma função.
-- ---------------------------------------------------------------------------
alter table private.admins
  add column username text not null unique;

-- ---------------------------------------------------------------------------
-- Bloqueio por tentativas (PRD §43).
--
-- Chave é o username, não o user_id: um username que não existe também deve
-- ser throttled, senão dá para testar quais contas existem por tempo de
-- resposta. `service_role` é o único papel com acesso — cliente e admin nunca
-- tocam esta tabela diretamente, só através da Server Action de login.
-- ---------------------------------------------------------------------------
create table private.login_throttle (
  username text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

grant usage on schema private to service_role;
grant select, insert, update, delete on private.admins to service_role;
grant select, insert, update, delete on private.login_throttle to service_role;
grant select on public.clients to service_role;
grant execute on function private.is_admin() to service_role;

-- Defesa em profundidade: mesmo que uma migration futura conceda privilégio
-- de tabela por engano a anon/authenticated, RLS sem política nenhuma nega
-- toda linha para quem não tem `bypassrls` (que é só o service_role).
alter table private.login_throttle enable row level security;
alter table private.login_throttle force row level security;

-- ---------------------------------------------------------------------------
-- Resolve um username (cliente OU admin) para id e e-mail sintético.
--
-- `security invoker`: quem chama (sempre `service_role`, ver GRANT abaixo) já
-- tem SELECT direto em `public.clients` e `private.admins`, concedido acima —
-- não precisa de `security definer` para enxergar as duas tabelas.
--
-- Devolve o id porque a Server Action de login precisa dele para banir a
-- conta via API admin quando o bloqueio por tentativas for acionado. Nunca
-- devolve status, vencimento ou qualquer outro dado (PRD §21) — só o
-- necessário para autenticar.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_login_identity(p_username text)
returns table (user_id uuid, email text)
language sql
security invoker
set search_path = ''
stable
as $$
  select id, lower(username) || '@internal.cartao.local'
  from public.clients where lower(username) = lower(p_username)
  union all
  select user_id, lower(username) || '@internal.cartao.local'
  from private.admins where lower(username) = lower(p_username)
  limit 1;
$$;

-- Só o service_role chama esta. A Server Action de login usa o cliente de
-- serviço para resolver a identidade e checar/registrar o bloqueio, e o
-- cliente comum (chave publicável + cookies) só para autenticar de fato — é
-- o segundo que grava a sessão no cookie corretamente.
revoke execute on function public.resolve_login_identity(text) from public;
grant execute on function public.resolve_login_identity(text) to service_role;

-- ---------------------------------------------------------------------------
-- Bloqueio por tentativas — três operações atômicas, para não haver corrida
-- entre requisições concorrentes tentando a mesma conta ao mesmo tempo.
--
-- `security invoker`: o único chamador previsto é `service_role`, que já tem
-- DML completo em `private.login_throttle` (concedido acima).
-- ---------------------------------------------------------------------------
create or replace function public.check_login_lock(p_username text)
returns timestamptz
language sql
security invoker
set search_path = ''
stable
as $$
  select locked_until from private.login_throttle
  where username = lower(p_username) and locked_until > now();
$$;

create or replace function public.register_login_failure(
  p_username text,
  p_max_attempts integer,
  p_lock_minutes integer
)
returns table (failed_count integer, locked_until timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row private.login_throttle%rowtype;
begin
  insert into private.login_throttle (username, failed_count, updated_at)
  values (lower(p_username), 1, now())
  on conflict (username) do update
    set failed_count = private.login_throttle.failed_count + 1,
        updated_at = now()
  returning * into v_row;

  if v_row.failed_count >= p_max_attempts then
    update private.login_throttle
      set locked_until = now() + make_interval(mins => p_lock_minutes),
          failed_count = 0
      where username = lower(p_username)
      returning * into v_row;
  end if;

  return query select v_row.failed_count, v_row.locked_until;
end;
$$;

create or replace function public.register_login_success(p_username text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from private.login_throttle where username = lower(p_username);
$$;

revoke execute on function public.check_login_lock(text) from public;
revoke execute on function public.register_login_failure(text, integer, integer) from public;
revoke execute on function public.register_login_success(text) from public;
grant execute on function public.check_login_lock(text) to service_role;
grant execute on function public.register_login_failure(text, integer, integer) to service_role;
grant execute on function public.register_login_success(text) to service_role;

-- `USAGE` no schema, não só `EXECUTE` na função: dentro de uma política de
-- RLS o nome já vem resolvido desde a criação da política, mas dentro do
-- corpo de outra função (como o wrapper abaixo) o papel que está chamando
-- precisa conseguir resolver `private.is_admin` como qualquer nome
-- qualificado — confirmado batendo de frente com "permission denied for
-- schema private" antes desta linha existir.
grant usage on schema private to authenticated;

create or replace function public.am_i_admin()
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select private.is_admin();
$$;

-- Este sim é para o usuário já logado perguntar sobre si mesmo — usado pelo
-- proxy e pelas páginas para decidir qual painel mostrar.
revoke execute on function public.am_i_admin() from public;
grant execute on function public.am_i_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Cadastro do administrador via API admin do Auth (script de operação, fora
-- do app). `private` nunca entra na lista de schemas expostos pela API de
-- dados — este wrapper é o único jeito de gravar em `private.admins` sem
-- alargar essa exposição.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_admin(p_user_id uuid, p_username text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into private.admins (user_id, username)
  values (p_user_id, lower(p_username))
  on conflict (user_id) do update set username = excluded.username;
$$;

revoke execute on function public.upsert_admin(uuid, text) from public;
grant execute on function public.upsert_admin(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Reserva o nome de usuário do administrador em `reserved_usernames`, para que
-- nenhum cliente possa usar o mesmo slug — isso colidiria no e-mail sintético
-- e seria uma fonte de confusão grave entre os dois papéis.
-- ---------------------------------------------------------------------------
insert into public.reserved_usernames (username, reason)
values (lower('Renandias101'), 'system')
on conflict (username) do nothing;
