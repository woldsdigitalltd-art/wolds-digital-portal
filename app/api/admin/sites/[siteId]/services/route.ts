import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import { encryptJSON } from '@/lib/crypto'
import {
  normalizeSchema,
  sanitiseDataAgainstSchema,
} from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ siteId: string }>
}

/** GET — list every attached service for a site (no decrypted data). */
export async function GET(_request: Request, ctx: RouteCtx) {
  const { siteId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_services')
    .select(`
      id, site_id, service_id, enabled, user_settings_data, created_at, updated_at,
      services:service_id (
        id, key, name, description, icon, sort_order, enabled,
        user_settings_schema
      )
    `)
    .eq('site_id', siteId)

  if (error) {
    console.error('list site_services failed:', error)
    return NextResponse.json(
      { error: `Could not load services for this site: ${error.message}` },
      { status: 500 }
    )
  }

  type Row = {
    id: string; site_id: string; service_id: string; enabled: boolean
    user_settings_data: string | null
    services: {
      id: string; key: string; name: string; description: string | null
      icon: string | null; sort_order: number; enabled: boolean
      user_settings_schema: unknown
    } | null
  }

  const links = (data as unknown as Row[] ?? []).map(row => ({
    id:                 row.id,
    site_id:            row.site_id,
    service_id:         row.service_id,
    service_key:        row.services?.key  ?? '',
    service_name:       row.services?.name ?? '',
    service_icon:       row.services?.icon ?? null,
    service_description: row.services?.description ?? null,
    enabled:            row.enabled,
    has_user_settings:  Boolean(row.user_settings_data),
    user_settings_data: null,
    user_settings_schema: normalizeSchema(row.services?.user_settings_schema),
  }))

  return NextResponse.json({ links })
}

interface AttachBody {
  service_id?:         string
  user_settings_data?: Record<string, unknown> | null
  enabled?:            boolean
}

/** POST — attach a service to a site. Optionally provide per-site user_settings_data. */
export async function POST(request: Request, ctx: RouteCtx) {
  const { siteId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: AttachBody
  try {
    body = (await request.json()) as AttachBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.service_id !== 'string' || !body.service_id) {
    return NextResponse.json({ error: 'service_id is required.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load the service to fetch the user_settings_schema for sanitisation.
  const { data: svc, error: svcErr } = await admin
    .from('services')
    .select('id, user_settings_schema')
    .eq('id', body.service_id)
    .maybeSingle()
  if (svcErr) {
    console.error('load service failed:', svcErr)
    return NextResponse.json({ error: svcErr.message }, { status: 500 })
  }
  if (!svc) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 })
  }

  // Build the insert.
  const insert: Record<string, unknown> = {
    site_id:    siteId,
    service_id: body.service_id,
    enabled:    body.enabled !== false,
  }

  if (body.user_settings_data && typeof body.user_settings_data === 'object') {
    const schema  = normalizeSchema(svc.user_settings_schema)
    const cleaned = sanitiseDataAgainstSchema(schema, body.user_settings_data)
    insert.user_settings_data = encryptJSON(cleaned)
  }

  const { data: link, error: insErr } = await admin
    .from('site_services')
    .insert(insert)
    .select('id')
    .single()

  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json(
        { error: 'That service is already attached to this site.' },
        { status: 409 }
      )
    }
    console.error('attach service failed:', insErr)
    return NextResponse.json(
      { error: `Could not attach service: ${insErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: link.id }, { status: 201 })
}
