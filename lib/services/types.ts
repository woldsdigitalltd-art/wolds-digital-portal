/**
 * Shared types for the services catalog. Lives outside `server-only`
 * boundaries so they can be imported by client components too.
 */

export type FieldType =
  | 'text'
  | 'password'
  | 'url'
  | 'email'
  | 'number'
  | 'boolean'
  | 'textarea'

export interface ServiceField {
  /** machine-readable identifier — used as the key in *_data JSON */
  key:          string
  /** human-readable label shown in the form */
  label:        string
  type:         FieldType
  required?:    boolean
  placeholder?: string
  description?: string
}

export interface ServiceSchema {
  fields: ServiceField[]
}

export interface ServiceSummary {
  id:          string
  key:         string
  name:        string
  description: string | null
  icon:        string | null
  enabled:     boolean
  sort_order:  number
  has_global_settings: boolean
  has_user_settings:   boolean
  created_at:  string
  updated_at:  string
}

export interface ServiceDetail extends ServiceSummary {
  global_settings_schema: ServiceSchema | null
  /** Decrypted on the server — only sent in detail responses. */
  global_settings_data:   Record<string, unknown> | null
  user_settings_schema:   ServiceSchema | null
}

export interface SiteServiceLink {
  id:                 string
  site_id:            string
  service_id:         string
  service_key:        string
  service_name:       string
  service_icon:       string | null
  service_description: string | null
  enabled:            boolean
  /** True if this link has a user_settings_data row stored. */
  has_user_settings:  boolean
  /** Decrypted on the server — only sent when requested. */
  user_settings_data: Record<string, unknown> | null
  /** Convenience: the user_settings_schema from the parent service. */
  user_settings_schema: ServiceSchema | null
}

const VALID_TYPES: FieldType[] = [
  'text', 'password', 'url', 'email', 'number', 'boolean', 'textarea',
]

const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,62}$/

/** Validates and normalises a ServiceSchema. Returns null if input isn't a usable shape. */
export function normalizeSchema(raw: unknown): ServiceSchema | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const rawFields = obj.fields
  if (!Array.isArray(rawFields)) return { fields: [] }

  const seen = new Set<string>()
  const fields: ServiceField[] = []
  for (const item of rawFields) {
    if (!item || typeof item !== 'object') continue
    const f = item as Record<string, unknown>
    const key   = typeof f.key   === 'string' ? f.key.trim()   : ''
    const label = typeof f.label === 'string' ? f.label.trim() : ''
    const type  = typeof f.type  === 'string' ? f.type as FieldType : 'text'
    if (!FIELD_KEY_REGEX.test(key) || !label) continue
    if (!VALID_TYPES.includes(type))         continue
    if (seen.has(key))                       continue
    seen.add(key)
    fields.push({
      key,
      label,
      type,
      required:    Boolean(f.required),
      placeholder: typeof f.placeholder === 'string' ? f.placeholder : undefined,
      description: typeof f.description === 'string' ? f.description : undefined,
    })
  }
  return { fields }
}

/** Strips unknown keys from a data object so we only store what the schema declares. */
export function sanitiseDataAgainstSchema(
  schema: ServiceSchema | null,
  data:   unknown,
): Record<string, unknown> {
  if (!schema || !data || typeof data !== 'object') return {}
  const allowed = new Set(schema.fields.map(f => f.key))
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (allowed.has(k)) result[k] = v
  }
  return result
}
