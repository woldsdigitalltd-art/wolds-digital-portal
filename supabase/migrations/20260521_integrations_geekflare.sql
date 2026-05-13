-- Wolds Digital Portal — Geekflare integrations (Page Speed + Broken Links).
--
-- Both products go through the same Geekflare API key, so a single
-- `api_key` field is sufficient on each row. They start disabled —
-- the admin pastes the key in /admin/integrations and toggles each
-- one on. Neither provisions a remote resource: attaching to a site
-- runs the audit synchronously and stores the result blob on
-- `site_integrations.provider_metadata` (column added by
-- 20260519_integrations_seoscoreapi.sql).
--
-- Safe to re-run: both inserts use `on conflict (key) do nothing`.

insert into public.integrations (key, name, required_fields, input_values, enabled)
values (
  'pagespeed',
  'Page Speed',
  jsonb_build_array(
    jsonb_build_object(
      'key',         'api_key',
      'label',       'API key',
      'type',        'password',
      'required',    true,
      'placeholder', 'gf_…',
      'help',        'Found in your Geekflare dashboard. The same key works for Broken Links.'
    )
  ),
  '{}'::jsonb,
  false
)
on conflict (key) do nothing;

insert into public.integrations (key, name, required_fields, input_values, enabled)
values (
  'brokenlinks',
  'Broken Links',
  jsonb_build_array(
    jsonb_build_object(
      'key',         'api_key',
      'label',       'API key',
      'type',        'password',
      'required',    true,
      'placeholder', 'gf_…',
      'help',        'Found in your Geekflare dashboard. The same key works for Page Speed.'
    )
  ),
  '{}'::jsonb,
  false
)
on conflict (key) do nothing;
