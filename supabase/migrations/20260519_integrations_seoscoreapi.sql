-- Wolds Digital Portal — SEO Score (seoscoreapi.com) integration.
--
-- Adds the row-level audit report column to `site_integrations` so the
-- portal can render the latest SEO snapshot without re-hitting the
-- provider on every request, and seeds the catalogue row for SEO Score.
--
-- Safe to re-run: the column add is idempotent, the catalogue insert
-- uses ON CONFLICT.

------------------------------------------------------------
-- 1.  site_integrations.provider_metadata
------------------------------------------------------------
-- Stores the full audit JSON returned by seoscoreapi.com so the admin
-- UI and the customer portal can render the report directly. Other
-- providers (e.g. Better Stack) ignore the column and continue to read
-- live state from the remote API on render.
alter table public.site_integrations
  add column if not exists provider_metadata jsonb;

------------------------------------------------------------
-- 2.  integrations seed — SEO Score
------------------------------------------------------------
-- The integration starts disabled; the admin pastes the API key in
-- /admin/integrations and then toggles it on. No remote resource is
-- provisioned when the integration is attached to a site — the audit
-- runs synchronously and the result is stored in provider_metadata.
insert into public.integrations (key, name, required_fields, input_values, enabled)
values (
  'seoscoreapi',
  'SEO Score',
  jsonb_build_array(
    jsonb_build_object(
      'key',         'api_key',
      'label',       'API key',
      'type',        'password',
      'required',    true,
      'placeholder', 'sk_…',
      'help',        'Found in your seoscoreapi.com dashboard under API keys.'
    )
  ),
  '{}'::jsonb,
  false
)
on conflict (key) do nothing;
