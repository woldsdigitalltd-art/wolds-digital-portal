import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import { encryptJSON, decryptJSON } from '@/lib/crypto'
import {
  normalizeSchema,
  sanitiseDataAgainstSchema,
  type ServiceDetail,
  type ServiceSchema,
} from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

/**
 * GET — full service detail, including the *decrypted* global settings.
 * Admin-only.
 */
export async function GET(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services')
    .select(`
      id, key, name, description, icon, enabled, sort_order,
      created_at, updated_at,
      global_settings_schema, global_settings_data, user_settings_schema
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('get service failed:', error)
    return NextResponse.json(
      { error: `Could not load service: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 })
  }

  // Attempt to decrypt global data. If the key has rotated or the
  // ciphertext is corrupt we surface a soft error rather than 500ing
  // so the admin can still edit other fields and reset the data.
  let globalData: Record<string, unknown> | null = null
  let decryptError: string | null = null
  try {
    globalData = decryptJSON<Record<string, unknown>>(data.global_settings_data)
  } catch (err) {
    decryptError = err instanceof Error ? err.message : 'Decryption failed.'
  }

  const service: ServiceDetail = {
    id:          data.id,
    key:         data.key,
    name:        data.name,
    description: data.description,
    icon:        data.icon,
    enabled:     data.enabled,
    sort_order:  data.sort_order,
    has_global_settings: Boolean(data.global_settings_data),
    has_user_settings:   Boolean(data.user_settings_schema),
    created_at:  data.created_at,
    updated_at:  data.updated_at,
    global_settings_schema: normalizeSchema(data.global_settings_schema),
    user_settings_schema:   normalizeSchema(data.user_settings_schema),
    global_settings_data:   globalData,
  }

  return NextResponse.json({ service, decrypt_error: decryptError })
}

interface PatchBody {
  name?:                   string
  description?:            string | null
  icon?:                   string | null
  sort_order?:             number
  enabled?:                boolean
  global_settings_schema?: unknown
  user_settings_schema?:   unknown
  /**
   * Pass `null` to wipe the stored global data.
   * Pass an object to re-encrypt and replace it.
   * Omit entirely to leave it untouched.
   */
  global_settings_data?:   Record<string, unknown> | null
}

/** PATCH — update any subset of a service's fields. Re-encrypts global data when provided. */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // We need the current schema if we're updating data — sanitise the
  // incoming data against whatever the *new or existing* schema is.
  const { data: existing, error: loadErr } = await admin
    .from('services')
    .select('global_settings_schema')
    .eq('id', id)
    .maybeSingle()

  if (loadErr) {
    console.error('load service for patch failed:', loadErr)
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 })
  }

  const patch: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const trimmed = body.name.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
    }
    patch.name = trimmed
  }
  if (typeof body.description === 'string' || body.description === null) {
    patch.description =
      typeof body.description === 'string' ? body.description.trim() || null : null
  }
  if (typeof body.icon === 'string' || body.icon === null) {
    patch.icon = typeof body.icon === 'string' ? body.icon.trim() || null : null
  }
  if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
    patch.sort_order = Math.round(body.sort_order)
  }
  if (typeof body.enabled === 'boolean') {
    patch.enabled = body.enabled
  }

  let nextGlobalSchema: ServiceSchema | null | undefined
  if ('global_settings_schema' in body) {
    nextGlobalSchema = normalizeSchema(body.global_settings_schema)
    patch.global_settings_schema = nextGlobalSchema
  }
  if ('user_settings_schema' in body) {
    patch.user_settings_schema = normalizeSchema(body.user_settings_schema)
  }

  if ('global_settings_data' in body) {
    if (body.global_settings_data === null) {
      patch.global_settings_data = null
    } else {
      const schema = nextGlobalSchema ?? normalizeSchema(existing.global_settings_schema)
      const cleaned = sanitiseDataAgainstSchema(schema, body.global_settings_data)
      patch.global_settings_data = encryptJSON(cleaned)
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const { error: updErr } = await admin
    .from('services')
    .update(patch)
    .eq('id', id)

  if (updErr) {
    console.error('update service failed:', updErr)
    return NextResponse.json(
      { error: `Could not update service: ${updErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

/** DELETE — remove the service. site_services rows cascade. */
export async function DELETE(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { error } = await admin.from('services').delete().eq('id', id)

  if (error) {
    console.error('delete service failed:', error)
    return NextResponse.json(
      { error: `Could not delete service: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
