import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import type { Integration } from '@/lib/integrations/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

const SAFE_COLUMNS = `
  id, key, name, description, icon, provider, provider_url,
  provisioning_required, embed_enabled, enabled, sort_order,
  created_at, updated_at
`

/** GET — single integration metadata (no credentials). */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('integrations')
    .select(SAFE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('get integration failed:', error)
    return NextResponse.json(
      { error: `Could not load integration: ${error.message}` },
      { status: 500 },
    )
  }
  if (!data) return NextResponse.json({ error: 'Integration not found.' }, { status: 404 })

  return NextResponse.json({ integration: data as Integration })
}

interface PatchBody {
  name?:                  string
  description?:           string | null
  icon?:                  string | null
  provider?:              string | null
  provider_url?:          string | null
  sort_order?:            number
  enabled?:               boolean
  provisioning_required?: boolean
  embed_enabled?:         boolean
}

/** PATCH — update any subset of metadata fields. `credentials` is intentionally rejected. */
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

  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string') {
    const t = body.name.trim()
    if (!t) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
    patch.name = t
  }
  if (body.description !== undefined) {
    patch.description = typeof body.description === 'string'
      ? body.description.trim() || null
      : null
  }
  if (body.icon !== undefined) {
    patch.icon = typeof body.icon === 'string' ? body.icon.trim() || null : null
  }
  if (body.provider !== undefined) {
    patch.provider = typeof body.provider === 'string' ? body.provider.trim() || null : null
  }
  if (body.provider_url !== undefined) {
    patch.provider_url = typeof body.provider_url === 'string' ? body.provider_url.trim() || null : null
  }
  if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
    patch.sort_order = Math.round(body.sort_order)
  }
  if (typeof body.enabled === 'boolean')               patch.enabled               = body.enabled
  if (typeof body.provisioning_required === 'boolean') patch.provisioning_required = body.provisioning_required
  if (typeof body.embed_enabled === 'boolean')         patch.embed_enabled         = body.embed_enabled

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('integrations').update(patch).eq('id', id)
  if (error) {
    console.error('update integration failed:', error)
    return NextResponse.json(
      { error: `Could not update integration: ${error.message}` },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}

/** DELETE — remove integration row (site_integrations cascade). */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { error } = await admin.from('integrations').delete().eq('id', id)
  if (error) {
    console.error('delete integration failed:', error)
    return NextResponse.json(
      { error: `Could not delete integration: ${error.message}` },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
