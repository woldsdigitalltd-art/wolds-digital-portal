/**
 * Integrations data model.
 *
 * `integrations`        — catalogue of external providers we support.
 *                          Each row owns its own form schema in
 *                          `required_fields`, the values an admin has
 *                          saved in `input_values`, and a top-level
 *                          `enabled` flag.
 *
 * `site_integrations`   — many-to-many link between sites and
 *                          integrations, with provisioning lifecycle
 *                          state.
 */

export type IntegrationStatus =
  | 'pending'
  | 'provisioning'
  | 'active'
  | 'error'
  | 'cancelled'

export type IntegrationFieldType =
  | 'text'
  | 'password'
  | 'email'
  | 'url'
  | 'number'

export interface IntegrationField {
  key:          string
  label:        string
  type:         IntegrationFieldType
  required:     boolean
  placeholder?: string
  help?:        string
}

export interface Integration {
  id:              string
  key:             string
  name:            string
  required_fields: IntegrationField[] | null
  /** Server-side raw values; password fields are masked before sending to the browser. */
  input_values:    Record<string, string> | null
  enabled:         boolean
  created_at?:     string
  updated_at?:     string
}

export type ScheduleFrequency = 'off' | 'daily' | 'weekly' | 'monthly'

export interface SiteIntegration {
  id:                   string
  site_id:              string
  integration_id:       string
  status:               IntegrationStatus
  provider_resource_id: string | null
  /**
   * Provider-specific payload kept alongside the link row. Used by
   * integrations that store their state locally rather than fetching
   * it live (e.g. SEO Score stores the latest audit report here).
   */
  provider_metadata:    Record<string, unknown> | null
  last_error:           string | null
  provisioned_at:       string | null
  created_at:           string
  updated_at:           string
  /* Schedule fields — only meaningful for audit integrations. */
  schedule_frequency:    ScheduleFrequency
  schedule_hour:         number | null
  schedule_day_of_week:  number | null
  schedule_day_of_month: number | null
  schedule_last_run_at:  string | null
  schedule_next_run_at:  string | null
  /** Present when the API joins `integrations`. */
  integration?:         Pick<Integration, 'key' | 'name'>
}

/* ─────────────────────────────────── Helpers ──────────────────────────────── */

const VALID_STATUSES: IntegrationStatus[] = [
  'pending', 'provisioning', 'active', 'error', 'cancelled',
]

export function isIntegrationStatus(value: unknown): value is IntegrationStatus {
  return typeof value === 'string' && (VALID_STATUSES as string[]).includes(value)
}

/** Visual placeholder used for masked password values in the browser. */
export const MASKED_PASSWORD = '••••••••'

/**
 * Replace every password field's value with a fixed bullet string so
 * the browser never receives the real secret.
 */
export function maskPasswordFields(integration: Integration): Integration {
  if (!integration.required_fields || !integration.input_values) return integration
  const masked = { ...integration.input_values }
  for (const field of integration.required_fields) {
    if (field.type === 'password' && masked[field.key]) {
      masked[field.key] = MASKED_PASSWORD
    }
  }
  return { ...integration, input_values: masked }
}

/**
 * Returns the labels of any required fields that don't yet have a
 * value in `input_values` (empty string counts as missing).
 */
export function missingRequiredFields(integration: Integration): string[] {
  const fields = integration.required_fields ?? []
  const values = integration.input_values    ?? {}
  return fields
    .filter(f => f.required && !String(values[f.key] ?? '').trim())
    .map(f => f.label)
}

/** True iff every `required: true` field has a non-empty value saved. */
export function isReadyToEnable(integration: Integration): boolean {
  return missingRequiredFields(integration).length === 0
}
