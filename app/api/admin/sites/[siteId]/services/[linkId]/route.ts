import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import { isStatus, sanitiseDataAgainstSchema } from '@/lib/services/types'
import type { SiteServiceStatus } from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ siteId: string; linkId: string }>
}

/** GET — one site_service row with credentials and the joined service / auth labels. */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { siteId, linkId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_services')
    .select(`
      id, site_id, service_id, auth_type_id, credentials, status,
      provider_resource_id, last_error, provisioned_at, created_at, updated_at,
      services:service_id ( key, name, icon ),
      service_auth_types:auth_type_id ( auth_type, label, settings_schema )
    `)
    .eq('site_id', siteId)
    .eq('id',      linkId)
    .maybeSingle()

  if (error) {
    console.error('get site service failed:', error)
    return NextResponse.json(
      { error: `Could not load site service: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'Site service not found.' }, { status: 404 })
  }

  return NextResponse.json({ link: data })
}

interface PatchBody {
  credentials?:          Record<string, unknown>
  status?:               SiteServiceStatus
  provider_resource_id?: string | null
  last_error?:           string | null
}

/**
 * PATCH — update credentials and/or status on an existing link.
 * The auth_type_id is immutable: to switch connection method the
 * admin must delete and re-create the link.
 */
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

  const { data: existing, error: fetchErr } = await admin
    .from('site_services')
    .select(`
      id, auth_type_id,
      service_auth_types:auth_type_id ( settings_schema )
    `)
    .eq('site_id', siteId)
    .eq('id',      linkId)
    .maybeSingle()
  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Site service not found.' }, { status: 404 })
  }

  const patch: Record<string, unknown> = {}

  if (body.credentials !== undefined) {
    const schema =
      (existing.service_auth_types as unknown as { settings_schema?: { fields: never[] } | null } | null)
        ?.settings_schema ?? null
    patch.credentials = sanitiseDataAgainstSchema(schema, body.credentials)
  }
  if (body.status !== undefined) {
    if (!isStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 })
    }
    patch.status = body.status
    if (body.status !== 'error') patch.last_error = null
  }
  if (body.provider_resource_id !== undefined) {
    patch.provider_resource_id =
      typeof body.provider_resource_id === 'string'
        ? body.provider_resource_id.trim() || null
        : null
  }
  if (body.last_error !== undefined) {
    patch.last_error =
      typeof body.last_error === 'string' ? body.last_error.trim() || null : null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const { error } = await admin
    .from('site_services')
    .update(patch)
    .eq('site_id', siteId)
    .eq('id',      linkId)

  if (error) {
    console.error('update site service failed:', error)
    return NextResponse.json(
      { error: `Could not update site service: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}

/** DELETE — permanently remove the link. Use PATCH status='cancelled' for a soft-off. */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { siteId, linkId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { error } = await admin
    .from('site_services')
    .delete()
    .eq('site_id', siteId)
    .eq('id',      linkId)

  if (error) {
    console.error('delete site service failed:', error)
    return NextResponse.json(
      { error: `Could not detach service: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
