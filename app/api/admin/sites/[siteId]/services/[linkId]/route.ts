import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import { encryptJSON, decryptJSON } from '@/lib/crypto'
import {
  normalizeSchema,
  sanitiseDataAgainstSchema,
} from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ siteId: string; linkId: string }>
}

/** GET — full detail for a single site_services link, including DECRYPTED user_settings_data. */
export async function GET(_request: Request, ctx: RouteCtx) {
  const { siteId, linkId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_services')
    .select(`
      id, site_id, service_id, enabled, user_settings_data,
      services:service_id (
        id, key, name, description, icon, user_settings_schema
      )
    `)
    .eq('id', linkId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) {
    console.error('get site_service failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Link not found.' }, { status: 404 })
  }

  type Row = typeof data & {
    services: {
      id: string; key: string; name: string; description: string | null
      icon: string | null; user_settings_schema: unknown
    } | null
  }
  const row = data as unknown as Row

  let userData: Record<string, unknown> | null = null
  let decryptError: string | null = null
  try {
    userData = decryptJSON<Record<string, unknown>>(row.user_settings_data)
  } catch (err) {
    decryptError = err instanceof Error ? err.message : 'Decryption failed.'
  }

  return NextResponse.json({
    link: {
      id:                 row.id,
      site_id:            row.site_id,
      service_id:         row.service_id,
      service_key:        row.services?.key  ?? '',
      service_name:       row.services?.name ?? '',
      service_icon:       row.services?.icon ?? null,
      service_description: row.services?.description ?? null,
      enabled:            row.enabled,
      has_user_settings:  Boolean(row.user_settings_data),
      user_settings_data: userData,
      user_settings_schema: normalizeSchema(row.services?.user_settings_schema),
    },
    decrypt_error: decryptError,
  })
}

interface PatchBody {
  enabled?:            boolean
  user_settings_data?: Record<string, unknown> | null
}

/** PATCH — update per-site user settings or toggle the link enabled/disabled. */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const { siteId, linkId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Need to fetch the schema if we're updating data.
  const { data: existing, error: loadErr } = await admin
    .from('site_services')
    .select(`
      id,
      services:service_id ( user_settings_schema )
    `)
    .eq('id', linkId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (loadErr) {
    console.error('load link for patch failed:', loadErr)
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Link not found.' }, { status: 404 })
  }

  const patch: Record<string, unknown> = {}

  if (typeof body.enabled === 'boolean') {
    patch.enabled = body.enabled
  }

  if ('user_settings_data' in body) {
    if (body.user_settings_data === null) {
      patch.user_settings_data = null
    } else if (body.user_settings_data && typeof body.user_settings_data === 'object') {
      type Row = { services: { user_settings_schema: unknown } | null }
      const row = existing as unknown as Row
      const schema  = normalizeSchema(row.services?.user_settings_schema)
      const cleaned = sanitiseDataAgainstSchema(schema, body.user_settings_data)
      patch.user_settings_data = encryptJSON(cleaned)
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const { error: updErr } = await admin
    .from('site_services')
    .update(patch)
    .eq('id', linkId)
    .eq('site_id', siteId)

  if (updErr) {
    console.error('update site_service failed:', updErr)
    return NextResponse.json(
      { error: `Could not update service link: ${updErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

/** DELETE — detach the service from the site. */
export async function DELETE(_request: Request, ctx: RouteCtx) {
  const { siteId, linkId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { error } = await admin
    .from('site_services')
    .delete()
    .eq('id', linkId)
    .eq('site_id', siteId)

  if (error) {
    console.error('detach service failed:', error)
    return NextResponse.json(
      { error: `Could not detach service: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
