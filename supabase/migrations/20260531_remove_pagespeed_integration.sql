-- Remove the Page Speed integration and all related data.
-- The Google PSI / Geekflare Lighthouse approach proved unworkable;
-- the feature is removed entirely.

-- 1. Detach any site_integrations rows still using pagespeed.
delete from public.site_integrations
where integration_id in (
  select id from public.integrations where key = 'pagespeed'
);

-- 2. Remove any incidents raised by page-speed rules.
delete from public.incidents
where integration_key = 'page-speed';

-- 3. Delete the integration definition itself.
delete from public.integrations where key = 'pagespeed';
