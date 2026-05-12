/**
 * Shared types for the integrations catalog.
 *
 * Data model (in-DB):
 *   public.integrations       — what Wolds Digital offers (uptime, ssl,
 *                                analytics, whats_on). Holds the
 *                                provider credentials in a `credentials`
 *                                JSONB column that is *not* exposed to
 *                                clients (RLS-protected, server-only).
 *   public.site_integrations  — per-site link with `config` (site-specific
 *                                values like the GA property ID), a
 *                                lifecycle `status`, and provider-side
 *                                identifiers / metadata.
 */

export type IntegrationKey = 'uptime' | 'ssl' | 'analytics' | 'whats_on'

export type IntegrationStatus =
  | 'pending'
  | 'provisioning'
  | 'active'
  | 'error'
  | 'suspended'
  | 'cancelled'

export interface Integration {
  id:                    string
  key:                   IntegrationKey | string
  name:                  string
  description:           string | null
  icon:                  string | null
  provider:              string | null
  provider_url:          string | null
  provisioning_required: boolean
  embed_enabled:         boolean
  enabled:               boolean
  sort_order:            number
  created_at?:           string
  updated_at?:           string
}

export interface SiteIntegration {
  id:                   string
  site_id:              string
  integration_id:       string
  /* eslint-disable @typescript-eslint/no-explicit-any */
  config:               Record<string, any> | null
  provider_metadata:    Record<string, any> | null
  /* eslint-enable  @typescript-eslint/no-explicit-any */
  status:               IntegrationStatus
  provider_resource_id: string | null
  last_error:           string | null
  provisioned_at:       string | null
  created_at:           string
  updated_at:           string
  /** Present when the API joins `integrations`. */
  integration?:         Integration
}

/* ────────────────────────────────────────── Helpers ───────────────────────────────────── */

const VALID_STATUSES: IntegrationStatus[] = [
  'pending', 'provisioning', 'active', 'error', 'suspended', 'cancelled',
]

export function isIntegrationStatus(value: unknown): value is IntegrationStatus {
  return typeof value === 'string' && (VALID_STATUSES as string[]).includes(value)
}
