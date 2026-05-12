/**
 * Shared types for the services catalog. Lives outside `server-only`
 * boundaries so client components can import them too.
 *
 * Data model (in-DB):
 *   public.services             — service offerings (catalog)
 *   public.service_auth_types   — one or more connection methods per service
 *   public.services_with_auth   — view joining the above (read this instead of `services`)
 *   public.site_services        — per-site link with chosen auth_type, credentials, status
 *
 * Credentials are *currently* stored as plain JSONB in
 * `site_services.credentials`. The eventual Supabase Vault integration
 * will populate `credentials_vault_ids` and move sensitive values out
 * — keep that contract in mind when adding new code.
 */

export type AuthType =
  | 'platform_key'   // Wolds Digital uses its own API key on the customer's behalf
  | 'oauth_client'   // Customer authorises us via OAuth on their own account
  | 'oauth_platform' // Wolds Digital hosts a single shared OAuth account
  | 'manual'         // Customer pastes a value (property ID, embed code, etc.)

export type SiteServiceStatus =
  | 'pending'
  | 'provisioning'
  | 'active'
  | 'error'
  | 'suspended'
  | 'cancelled'

export type FieldType = 'text' | 'password' | 'email' | 'url' | 'select'

export interface SchemaFieldOption {
  value: string | number | boolean
  label: string
}

export interface SchemaField {
  key:          string
  label:        string
  type:         FieldType
  required:     boolean
  placeholder?: string
  help?:        string
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  default?:     any
  options?:     SchemaFieldOption[]
}

export interface SettingsSchema {
  fields: SchemaField[]
}

export interface ServiceAuthType {
  id:               string
  service_id:       string
  auth_type:        AuthType
  label:            string
  description:      string | null
  settings_schema:  SettingsSchema | null
  is_default:       boolean
  sort_order:       number
  created_at?:      string
  updated_at?:      string
}

export interface ServiceWithAuth {
  id:                    string
  key:                   string
  name:                  string
  description:           string | null
  icon:                  string | null
  provider:              string | null
  provisioning_required: boolean
  embed_enabled:         boolean
  enabled:               boolean
  sort_order:            number
  auth_options:          ServiceAuthType[]
  created_at?:           string
  updated_at?:           string
}

export interface SiteService {
  id:                    string
  site_id:               string
  service_id:            string
  auth_type_id:          string | null
  /* eslint-disable @typescript-eslint/no-explicit-any */
  credentials:           Record<string, any> | null
  credentials_vault_ids: Record<string, string> | null
  /* eslint-enable @typescript-eslint/no-explicit-any */
  status:                SiteServiceStatus
  provider_resource_id:  string | null
  last_error:            string | null
  provisioned_at:        string | null
  created_at:            string
  updated_at:            string
}

/* ────────────────────────────────────────── Helpers ───────────────────────────────────── */

const VALID_FIELD_TYPES: FieldType[] = ['text', 'password', 'email', 'url', 'select']
const VALID_AUTH_TYPES:  AuthType[]  = ['platform_key', 'oauth_client', 'oauth_platform', 'manual']
const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,62}$/

export function isAuthType(value: unknown): value is AuthType {
  return typeof value === 'string' && (VALID_AUTH_TYPES as string[]).includes(value)
}

export function isStatus(value: unknown): value is SiteServiceStatus {
  return (
    typeof value === 'string' &&
    ['pending', 'provisioning', 'active', 'error', 'suspended', 'cancelled'].includes(value)
  )
}

/**
 * Validates and normalises a settings schema submitted from the UI.
 * Drops invalid fields rather than rejecting the whole thing so partial
 * authoring works smoothly.
 */
export function normalizeSchema(raw: unknown): SettingsSchema | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') return null
  const rawObj = raw as { fields?: unknown }
  const rawFields = Array.isArray(rawObj.fields) ? rawObj.fields : []

  const seen = new Set<string>()
  const fields: SchemaField[] = []
  for (const item of rawFields) {
    if (!item || typeof item !== 'object') continue
    const f = item as Record<string, unknown>
    const key   = typeof f.key   === 'string' ? f.key.trim()   : ''
    const label = typeof f.label === 'string' ? f.label.trim() : ''
    const type  = typeof f.type  === 'string' ? (f.type as FieldType) : 'text'
    if (!FIELD_KEY_REGEX.test(key) || !label)    continue
    if (!VALID_FIELD_TYPES.includes(type))       continue
    if (seen.has(key))                           continue
    seen.add(key)

    const field: SchemaField = {
      key,
      label,
      type,
      required: Boolean(f.required),
    }
    if (typeof f.placeholder === 'string' && f.placeholder.length > 0) {
      field.placeholder = f.placeholder
    }
    if (typeof f.help === 'string' && f.help.length > 0) {
      field.help = f.help
    }
    if (f.default !== undefined) {
      field.default = f.default
    }
    if (type === 'select' && Array.isArray(f.options)) {
      const opts: SchemaFieldOption[] = []
      for (const o of f.options) {
        if (!o || typeof o !== 'object') continue
        const opt = o as Record<string, unknown>
        const optLabel = typeof opt.label === 'string' ? opt.label.trim() : ''
        if (!optLabel) continue
        if (opt.value === undefined) continue
        opts.push({
          value: opt.value as string | number | boolean,
          label: optLabel,
        })
      }
      field.options = opts
    }
    fields.push(field)
  }
  return { fields }
}

/** Strip keys not declared in the schema and coerce values to the declared field type. */
export function sanitiseDataAgainstSchema(
  schema: SettingsSchema | null,
  data:   unknown,
): Record<string, unknown> {
  if (!schema || !data || typeof data !== 'object') return {}
  const result: Record<string, unknown> = {}
  for (const f of schema.fields) {
    const v = (data as Record<string, unknown>)[f.key]
    if (v === undefined) continue
    if (v === '' || v === null) {
      result[f.key] = null
      continue
    }
    result[f.key] = v
  }
  return result
}
