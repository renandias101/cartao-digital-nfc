-- O segundo fator passa a ser parte da autorização administrativa no banco.
-- `am_i_admin_account` identifica a conta apenas para conduzir o desafio MFA;
-- todas as políticas e funções privilegiadas continuam usando `is_admin`.
create or replace function public.am_i_admin_account()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from private.admins
    where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.am_i_admin_account() from public;
grant execute on function public.am_i_admin_account() to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    and exists (
      select 1 from private.admins
      where user_id = (select auth.uid())
    );
$$;
