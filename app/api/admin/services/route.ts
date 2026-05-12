import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import {
  normalizeSchema,
  type ServiceSchema,
  type ServiceSummary,
} from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KEY_REGEX = /^[a-z][a-z0-9_-]{1,62}$/

/**
 * GET — list every service offering. Settings *data* is intentionally
 * NOT returned in list view (no decryption); the boolean
 * `has_global_settings` flag tells the UI whether values are stored.
 */
export async function GET() {
  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services')
    .select(`
      id, key, name, description, icon, enabled, sort_order,
      created_at, updated_at,
      global_settings_schema, user_settings_schema,
      global_settings_data
    `)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) {
    console.error('list services failed:', error)
    return NextResponse.json(
      { error: `Could not load services: ${error.message}` },
      { status: 500 }
    )
  }

  const services: ServiceSummary[] = (data ?? []).map(row => ({
    id:          row.id,
    key:         row.key,
    name:        row.name,
    description: row.description,
    icon:        row.icon,
    enabled:     row.enabled,
    sort_order:  row.sort_order,
    has_global_settings: Boolean(row.global_settings_data),
    has_user_settings:   Boolean(row.user_settings_schema),
    created_at:  row.created_at,
    updated_at:  row.updated_at,
  }))

  return NextResponse.json({ services })
}

interface CreateBody {
  key?:                    string
  name?:                   string
  description?:            string | null
  icon?:                   string | null
  sort_order?:             number
  enabled?:                boolean
  global_settings_schema?: unknown
  user_settings_schema?:   unknown
}

/**
 * POST — create a new service offering. Schemas (but not data) can be
 * provided up front; global data is set on a follow-up PATCH so the
 * encryption is only done once the values are known.
 */
export async function POST(request: Request) {
  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const key  = (body.key  ?? '').trim().toLowerCase()
  const name = (body.name ?? '').trim()
  if (!KEY_REGEX.test(key)) {
    return NextResponse.json(
      { error: 'Key must be lowercase letters/numbers/_/- (2–63 chars).' },
      { status: 400 }
    )
  }
  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }

  const globalSchema: ServiceSchema | null = normalizeSchema(body.global_settings_schema)
  const userSchema:   ServiceSchema | null = normalizeSchema(body.user_settings_schema)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services')
    .insert({
      key,
      name,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      icon:        typeof body.icon        === 'string' ? body.icon.trim()        || null : null,
      sort_order:  Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
      enabled:     body.enabled !== false,
      global_settings_schema: globalSchema,
      user_settings_schema:   userSchema,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A service with that key already exists.' },
        { status: 409 }
      )
    }
    console.error('create service failed:', error)
    return NextResponse.json(
      { error: `Could not create service: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
