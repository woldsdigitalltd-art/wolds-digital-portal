-- Wolds Digital Portal — RPC updates for the integrations rework.
--
-- The base table changes (integrations.{required_fields, input_values},
-- site_integrations.{status, provider_resource_id, last_error,
-- provisioned_at}) were applied out-of-band and the migration file is
-- not tracked here.
--
-- This migration just rewires the RPCs the portal/admin pages call so
-- they speak the new model:
--
--   • `get_my_websites()`  — returns each site with its active
--                            integrations as `{id, key, name}`. The
--                            old `uptime` snapshot is no longer
--                            embedded; the websites page fetches live
--                            status from Better Stack on render.
--
--   • `get_admin_stats()`  — counts a site as "monitored" when it has
--                            an active `betterstack` integration.
--
-- Safe to re-run: every statement is `create or replace`.

------------------------------------------------------------
-- 1.  get_my_websites — sites + active integrations
------------------------------------------------------------
create or replace function public.get_my_websites()
returns json
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  result    json;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select coalesce(json_agg(w order by w.domain), '[]'::json)
  into result
  from (
    select
      s.id,
      s.domain,
      s.display_name,
      coalesce(
        (
          select json_agg(
                   json_build_object(
                     'id',   i.id,
                     'key',  i.key,
                     'name', i.name
                   )
                   order by i.name
                 )
          from public.site_integrations si
          join public.integrations i on i.id = si.integration_id
          where si.site_id = s.id
            and si.status  = 'active'
        ),
        '[]'::json
      ) as integrations
    from public.sites s
    where s.owner_id = v_user_id
  ) w;

  return result;
end;
$$;

grant execute on function public.get_my_websites() to authenticated;

------------------------------------------------------------
-- 2.  get_admin_stats — count Better Stack-monitored sites
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
    'monitored_sites', (
      select count(distinct si.site_id)
      from public.site_integrations si
      join public.integrations i on i.id = si.integration_id
      where i.key      = 'betterstack'
        and si.status  = 'active'
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_admin_stats() to authenticated;
