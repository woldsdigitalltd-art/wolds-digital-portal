-- Wolds Digital Portal — per-site service flags + customer websites RPC
--
-- Run this once in Supabase Dashboard → SQL Editor.
--
-- Adds two boolean columns to public.sites so admins can mark which
-- services (Analytics, Uptime) are active for each linked domain, and
-- exposes a SECURITY DEFINER RPC the customer's /portal/websites view
-- uses to read its own data with the latest uptime sample joined in.

------------------------------------------------------------
-- 1. Per-site service flags
------------------------------------------------------------
alter table public.sites
  add column if not exists analytics_enabled boolean not null default false,
  add column if not exists uptime_enabled    boolean not null default false;

------------------------------------------------------------
-- 2. Customer-facing RPC: "give me my websites"
------------------------------------------------------------
-- Returns one row per site owned by the calling user, with the most
-- recent uptime sample left-joined in (or NULL if monitoring isn't
-- enabled / hasn't run yet). SECURITY DEFINER so RLS doesn't get in
-- the way, but the WHERE clause locks results to auth.uid().
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
      s.analytics_enabled,
      s.uptime_enabled,
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
