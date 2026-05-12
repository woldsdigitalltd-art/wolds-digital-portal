-- Wolds Digital Portal — global services catalog + per-site service link
--
-- Run this once in Supabase Dashboard → SQL Editor.
--
-- The old boolean flags on `public.sites` (analytics_enabled,
-- uptime_enabled) are superseded by this catalog model. We don't drop
-- them in this migration — they're just no longer referenced by the
-- app — so existing data is preserved if you ever want to migrate it
-- forward.

------------------------------------------------------------
-- 1.  Global service catalog
------------------------------------------------------------
-- Each row is a service offering Wolds Digital sells/manages. The two
-- *_schema columns are JSON arrays describing the form fields that
-- make up the global config and the per-user (per-site) config; the
-- *_data columns hold the actual values, AES-256-GCM encrypted at the
-- application layer.
create table if not exists public.services (
  id                      uuid primary key default gen_random_uuid(),
  key                     text unique not null,
  name                    text not null,
  description             text,
  icon                    text,                      -- lucide-react icon name e.g. 'BarChart3'
  global_settings_schema  jsonb,                     -- { fields: [...] } or null
  global_settings_data    text,                      -- encrypted JSON blob or null
  user_settings_schema    jsonb,                     -- { fields: [...] } or null
  enabled                 boolean not null default true,
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists services_enabled_idx
  on public.services(enabled, sort_order);

------------------------------------------------------------
-- 2.  Per-site service link
------------------------------------------------------------
-- One row per (site, service) pair. user_settings_data is the
-- AES-256-GCM ciphertext of the per-site values for the service's
-- user_settings_schema. NULL = "use whatever the global settings say".
create table if not exists public.site_services (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id)    on delete cascade,
  service_id          uuid not null references public.services(id) on delete cascade,
  user_settings_data  text,                          -- encrypted JSON blob or null
  enabled             boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (site_id, service_id)
);

create index if not exists site_services_site_idx    on public.site_services(site_id);
create index if not exists site_services_service_idx on public.site_services(service_id);

------------------------------------------------------------
-- 3.  updated_at trigger (shared)
------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

drop trigger if exists site_services_set_updated_at on public.site_services;
create trigger site_services_set_updated_at
  before update on public.site_services
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 4.  Customer-facing RPC
------------------------------------------------------------
-- Returns the calling user's sites with the attached services listed
-- as a JSON array (no settings_data — that's read on demand from the
-- API, never blanket-exposed to the client). Latest uptime sample is
-- still joined in.
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
            and ss.enabled = true
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

------------------------------------------------------------
-- 5.  Seed a couple of starter services so the catalog isn't empty
------------------------------------------------------------
insert into public.services (key, name, description, icon, sort_order)
values
  ('analytics', 'Analytics',         'Visitor analytics and reporting integration.',  'BarChart3', 10),
  ('uptime',    'Uptime monitoring', 'Continuous availability monitoring and alerts.', 'Activity',  20)
on conflict (key) do nothing;
