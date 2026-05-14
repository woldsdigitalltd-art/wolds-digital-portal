-- ─── incidents ────────────────────────────────────────────────────────────────
create table incidents (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  integration_key text not null,
  rule_key        text not null,
  title           text not null,
  description     text not null,
  severity        text not null check (severity in ('info', 'warning', 'critical')),
  status          text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  dismiss_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id)
);

create index on incidents (site_id, rule_key, status);
create index on incidents (site_id, status);

create function incidents_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger incidents_updated_at
before update on incidents
for each row execute procedure incidents_set_updated_at();

-- ─── incident_comments ────────────────────────────────────────────────────────
create table incident_comments (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  author_id   uuid not null references auth.users(id),
  author_role text not null check (author_role in ('admin', 'customer')),
  body        text not null,
  created_at  timestamptz not null default now()
);

create index on incident_comments (incident_id, created_at);

-- ─── alerts ───────────────────────────────────────────────────────────────────
create table alerts (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  integration_key text not null,
  rule_key        text not null,
  title           text not null,
  description     text,
  severity        text not null check (severity in ('info', 'warning', 'critical')),
  status          text not null default 'open' check (status in ('open', 'resolved')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index on alerts (site_id, status);
create index on alerts (site_id, rule_key, status);

-- ─── RLS: incidents ───────────────────────────────────────────────────────────
alter table incidents enable row level security;

create policy "Admin full read on incidents"
  on incidents for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

create policy "Customer read own incidents"
  on incidents for select
  using (
    exists (
      select 1 from sites
      where sites.id = incidents.site_id
        and sites.owner_id = auth.uid()
    )
  );

create policy "Customer update own incidents"
  on incidents for update
  using (
    exists (
      select 1 from sites
      where sites.id = incidents.site_id
        and sites.owner_id = auth.uid()
    )
  )
  with check (true);

create policy "Admin update any incident"
  on incidents for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (true);

-- ─── RLS: incident_comments ───────────────────────────────────────────────────
alter table incident_comments enable row level security;

create policy "Customer read own incident comments"
  on incident_comments for select
  using (
    exists (
      select 1
      from incidents i
      join sites s on s.id = i.site_id
      where i.id = incident_comments.incident_id
        and s.owner_id = auth.uid()
    )
  );

create policy "Admin full read on incident_comments"
  on incident_comments for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

create policy "Authenticated users insert comments"
  on incident_comments for insert
  with check (
    author_id = auth.uid() and (
      exists (
        select 1
        from incidents i
        join sites s on s.id = i.site_id
        where i.id = incident_comments.incident_id
          and s.owner_id = auth.uid()
      )
      or exists (
        select 1 from profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    )
  );

create policy "Users update own comments"
  on incident_comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Users delete own comments"
  on incident_comments for delete
  using (author_id = auth.uid());

-- ─── RLS: alerts ─────────────────────────────────────────────────────────────
alter table alerts enable row level security;

create policy "Customer read own alerts"
  on alerts for select
  using (
    exists (
      select 1 from sites
      where sites.id = alerts.site_id
        and sites.owner_id = auth.uid()
    )
  );

create policy "Admin full read on alerts"
  on alerts for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
