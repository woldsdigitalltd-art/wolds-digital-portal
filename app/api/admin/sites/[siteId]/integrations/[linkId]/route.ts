import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import { isIntegrationStatus } from '@/lib/integrations/types'
import type { IntegrationStatus } from '@/lib/integrations/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ siteId: string; linkId: string }>
}

/** GET — full row including config + joined integration metadata. */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { siteId, linkId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_integrations')
    .select(`
      id, site_id, integration_id, config, status,
      provider_resource_id, provider_metadata, last_error,
      provisioned_at, created_at, updated_at,
      integrations:integration_id ( key, name, icon, provider, provider_url )
    `)
    .eq('site_id', siteId)
    .eq('id',      linkId)
    .maybeSingle()

  if (error) {
    console.error('get site integration failed:', error)
    return NextResponse.json(
      { error: `Could not load site integration: ${error.message}` },
      { status: 500 },
    )
  }
  if (!data) return NextResponse.json({ error: 'Site integration not found.' }, { status: 404 })

  return NextResponse.json({ link: data })
}

interface PatchBody {
  config?:               Record<string, unknown>
  status?:               IntegrationStatus
  provider_resource_id?: string | null
  last_error?:           string | null
}

/** PATCH — update config (and optionally status / metadata). integration_id is immutable. */
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

  const patch: Record<string, unknown> = {}
  if (body.config !== undefined) {
    patch.config = body.config
  }
  if (body.status !== undefined) {
    if (!isIntegrationStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 })
    }
    patch.status = body.status
    if (body.status !== 'error') patch.last_error = null
  }
  if (body.provider_resource_id !== undefined) {
    patch.provider_resource_id = typeof body.provider_resource_id === 'string'
      ? body.provider_resource_id.trim() || null
      : null
  }
  if (body.last_error !== undefined) {
    patch.last_error = typeof body.last_error === 'string'
      ? body.last_error.trim() || null
      : null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('site_integrations')
    .update(patch)
    .eq('site_id', siteId)
    .eq('id',      linkId)

  if (error) {
    console.error('update site integration failed:', error)
    return NextResponse.json(
      { error: `Could not update site integration: ${error.message}` },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}

/** DELETE — permanently remove. For a soft "off" use PATCH status='cancelled'. */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { siteId, linkId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { error } = await admin
    .from('site_integrations')
    .delete()
    .eq('site_id', siteId)
    .eq('id',      linkId)

  if (error) {
    console.error('delete site integration failed:', error)
    return NextResponse.json(
      { error: `Could not detach integration: ${error.message}` },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
