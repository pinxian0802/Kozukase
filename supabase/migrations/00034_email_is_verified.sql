-- 提供後端查詢「某 Email 是否為已完成驗證的帳號」，用於註冊頁阻擋重複註冊。
-- SECURITY DEFINER 以存取 auth schema；僅開放 service_role 呼叫，避免成為公開的帳號探測管道。
create or replace function public.email_is_verified(p_email text)
returns boolean
language sql
security definer
set search_path = pg_catalog, auth
as $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(p_email)
      and u.email_confirmed_at is not null
  );
$$;

revoke execute on function public.email_is_verified(text) from public, anon, authenticated;
grant execute on function public.email_is_verified(text) to service_role;
