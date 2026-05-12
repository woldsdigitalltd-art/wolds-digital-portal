-- Wolds Digital Portal — get_my_websites() rewired onto the new
-- `integrations` and `site_integrations` tables.
--
-- Run this in Supabase Dashboard → SQL Editor once the new tables
-- exist. `create or replace` so it's safe to re-run.
--
-- It returns each site's `integrations` array (those whose
-- site_integrations.status = 'active') and, when uptime is attached,
-- a flat `uptime` object derived from
-- site_integrations.provider_metadata so the customer pages don't
-- need to know about Better Stack.

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
              'id',          i.id,
              'key',         i.key,
              'name',        i.name,
              'icon',        i.icon,
              'description', i.description,
              'config',      si.config
            )
            order by i.sort_order, i.name
          )
          from public.site_integrations si
          join public.integrations i on i.id = si.integration_id
          where si.site_id = s.id
            and si.status  = 'active'
            and i.enabled  = true
        ),
        '[]'::json
      ) as integrations,
      (
        select json_build_object(
          'status',            si.provider_metadata->>'status',
          'uptime_percentage', (si.provider_metadata->>'uptime_percentage')::numeric,
          'last_checked_at',   si.provider_metadata->>'last_checked_at'
        )
        from public.site_integrations si
        join public.integrations i on i.id = si.integration_id
        where si.site_id = s.id
          and i.key      = 'uptime'
          and si.status  = 'active'
        limit 1
      ) as uptime
    from public.sites s
    where s.owner_id = v_user_id
  ) w;

  return result;
end;
$$;

grant execute on function public.get_my_websites() to authenticated;

-- IMPORTANT: if your existing `get_my_portal_data()` RPC still
-- references the dropped `uptime_monitors` table, also update it to
-- pull uptime data from `site_integrations.provider_metadata` as
-- above. Its overall return shape can stay the same so the
-- /portal/uptime and /portal dashboard pages don't need code changes.

------------------------------------------------------------
-- 3.  get_admin_stats() — replace uptime_monitors count
------------------------------------------------------------
-- The admin overview page reads `monitored_sites`. The previous
-- definition counted distinct `site_id` from `uptime_monitors`, which
-- is gone. The new count is the number of sites with an *active*
-- uptime integration.

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
      where i.key      = 'uptime'
        and si.status  = 'active'
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_admin_stats() to authenticated;
