-- Wolds Digital Portal — customer websites RPC: filter by status='active'
--
-- Run this in Supabase Dashboard → SQL Editor if your existing
-- get_my_websites() function still filters site_services by
-- `ss.enabled = true`. This version drives "is the service on?" off
-- the new `status` column, treating `active` as on and everything
-- else (pending, provisioning, error, suspended, cancelled) as off.
--
-- `create or replace function` so it's safe to run more than once.

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
              'id',          svc.id,
              'key',         svc.key,
              'name',        svc.name,
              'icon',        svc.icon,
              'description', svc.description
            )
            order by svc.sort_order, svc.name
          )
          from public.site_services ss
          join public.services svc on svc.id = ss.service_id
          where ss.site_id = s.id
            and ss.status  = 'active'
            and svc.enabled = true
        ),
        '[]'::json
      ) as services,
      um.status              as uptime_status,
      um.uptime_percentage   as uptime_percentage,
      um.last_checked_at     as uptime_last_checked_at
    from public.sites s
    left join lateral (
      select status, uptime_percentage, last_checked_at
      from public.uptime_monitors
      where site_id = s.id
      order by last_checked_at desc nulls last
      limit 1
    ) um on true
    where s.owner_id = v_user_id
  ) w;

  return result;
end;
$$;

grant execute on function public.get_my_websites() to authenticated;
