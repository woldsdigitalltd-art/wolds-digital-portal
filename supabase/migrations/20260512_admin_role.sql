-- Wolds Digital Portal — admin role + admin RPCs
-- Run this once in Supabase Dashboard → SQL Editor.

------------------------------------------------------------
-- 1.  Add the is_admin flag to profiles
------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_is_admin_idx on public.profiles(is_admin);

------------------------------------------------------------
-- 2.  Helper: is the current user an admin?
------------------------------------------------------------
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

------------------------------------------------------------
-- 3.  Admin dashboard stats
------------------------------------------------------------
create or replace function public.get_admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result json;
begin
  if not public.is_current_user_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select json_build_object(
    'total_users',          (select count(*) from auth.users),
    'total_admins',         (select count(*) from public.profiles where is_admin),
    'total_customers',      (select count(*) from public.profiles
                             where coalesce(is_admin, false) = false),
    'total_companies',      (select count(distinct trim(company_name))
                             from public.profiles
                             where company_name is not null
                               and trim(company_name) <> ''
                               and coalesce(is_admin, false) = false),
    'total_websites',       (select count(*) from public.sites),
    'total_subscriptions',  (select count(*) from public.subscriptions),
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'monitored_sites',      (select count(distinct site_id) from public.uptime_monitors)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_admin_stats() to authenticated;

------------------------------------------------------------
-- 4.  Admin customer list (every non-admin user)
------------------------------------------------------------
create or replace function public.get_admin_customers()
returns json
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result json;
begin
  if not public.is_current_user_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(json_agg(c), '[]'::json)
  into result
  from (
    select
      u.id,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      p.full_name,
      p.company_name,
      p.phone,
      (select count(*) from public.sites s where s.owner_id = u.id) as site_count,
      sub.plan,
      sub.status              as subscription_status,
      sub.current_period_end  as subscription_renews_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join lateral (
      select plan, status, current_period_end
      from public.subscriptions s
      where s.owner_id = u.id
      order by updated_at desc nulls last
      limit 1
    ) sub on true
    where coalesce(p.is_admin, false) = false
    order by u.created_at desc nulls last
  ) c;

  return result;
end;
$$;

grant execute on function public.get_admin_customers() to authenticated;

------------------------------------------------------------
-- 5.  IMPORTANT — promote yourself to admin (run separately)
------------------------------------------------------------
-- After the above migration succeeds, run a query like this to mark
-- yourself as the first admin (replace the email):
--
--   update public.profiles
--   set    is_admin = true
--   where  id = (select id from auth.users where email = 'you@example.com');
