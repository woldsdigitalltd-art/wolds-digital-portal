-- Wolds Digital Portal — Review Monitoring integrations (Google Places & Trustpilot).
--
-- Adds per-site input_values column to site_integrations so admins can store
-- google_place_id and trustpilot_domain per site when linking the integration.
-- Also seeds the integration catalogue rows for Google Places and Trustpilot.
--
-- Safe to re-run: the column add is idempotent, the catalogue inserts use
-- ON CONFLICT, and the removed columns don't exist yet (review_monitor.sql is
-- a draft that hasn't been applied).

------------------------------------------------------------
-- 1.  site_integrations.input_values — per-site configuration
------------------------------------------------------------
-- Stores per-site config like google_place_id, trustpilot_domain, etc.
-- This allows each site to have different credentials or IDs for the same
-- integration (e.g., different Google Place IDs for different websites).
alter table public.site_integrations
  add column if not exists input_values jsonb default '{}'::jsonb;

------------------------------------------------------------
-- 2.  integrations seed — Google Places
------------------------------------------------------------
insert into public.integrations (key, name, required_fields, input_values, enabled)
values (
  'google_places',
  'Google Places',
  jsonb_build_array(
    jsonb_build_object(
      'key',         'api_key',
      'label',       'Google Places API key',
      'type',        'password',
      'required',    true,
      'placeholder', 'AIzaSy…',
      'help',        'Create a Google Cloud project, enable the Places API, and generate an API key from the credentials page.'
    )
  ),
  '{}'::jsonb,
  false
)
on conflict (key) do nothing;

------------------------------------------------------------
-- 3.  integrations seed — Trustpilot
------------------------------------------------------------
insert into public.integrations (key, name, required_fields, input_values, enabled)
values (
  'trustpilot',
  'Trustpilot',
  jsonb_build_array(
    jsonb_build_object(
      'key',         'api_key',
      'label',       'Trustpilot API key',
      'type',        'password',
      'required',    true,
      'placeholder', 'Bearer …',
      'help',        'Generate an access token from your Trustpilot Business dashboard under API settings.'
    )
  ),
  '{}'::jsonb,
  false
)
on conflict (key) do nothing;
