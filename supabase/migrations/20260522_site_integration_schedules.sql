-- Wolds Digital Portal — per-site-integration audit schedules
--
-- Admins can configure SEO / Performance / Broken-link audits to run on
-- a recurring schedule (off | daily | weekly | monthly) at a chosen UTC
-- hour. The Vercel cron job at /api/cron/run-scheduled-audits picks up
-- rows whose `schedule_next_run_at` has passed and fires the audit.
--
-- Columns are scoped to `site_integrations` (rather than a separate
-- table) because schedules are 1:1 with the integration link.

alter table public.site_integrations
  add column if not exists schedule_frequency     text         not null default 'off'
    check (schedule_frequency in ('off', 'daily', 'weekly', 'monthly')),
  add column if not exists schedule_hour          smallint
    check (schedule_hour is null or (schedule_hour >= 0 and schedule_hour <= 23)),
  add column if not exists schedule_day_of_week   smallint
    check (schedule_day_of_week is null or (schedule_day_of_week >= 0 and schedule_day_of_week <= 6)),
  add column if not exists schedule_day_of_month  smallint
    check (schedule_day_of_month is null or (schedule_day_of_month >= 1 and schedule_day_of_month <= 28)),
  add column if not exists schedule_last_run_at   timestamptz,
  add column if not exists schedule_next_run_at   timestamptz;

-- The cron worker scans for due schedules; an index keeps that cheap
-- even as the table grows. Partial index excludes 'off' rows since the
-- worker filters those out.
create index if not exists site_integrations_schedule_due_idx
  on public.site_integrations (schedule_next_run_at)
  where schedule_frequency <> 'off';
