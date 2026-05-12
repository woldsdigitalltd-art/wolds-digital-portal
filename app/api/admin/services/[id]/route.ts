import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import type { ServiceWithAuth } from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

/** GET — full detail of one service, including its auth_options. */
export async function GET(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services_with_auth')
    .select('*')
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

  return NextResponse.json({ service: data as ServiceWithAuth })
}

interface PatchBody {
  name?:                  string
  description?:           string | null
  icon?:                  string | null
  sort_order?:            number
  enabled?:               boolean
  provider?:              string | null
  provisioning_required?: boolean
  embed_enabled?:         boolean
}

/** PATCH — update any subset of a service's metadata. Auth options have their own routes. */
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
  if (typeof body.description === 'string' || body.description === null) {
    patch.description =
      typeof body.description === 'string' ? body.description.trim() || null : null
  }
  if (typeof body.icon === 'string' || body.icon === null) {
    patch.icon = typeof body.icon === 'string' ? body.icon.trim() || null : null
  }
  if (typeof body.provider === 'string' || body.provider === null) {
    patch.provider = typeof body.provider === 'string' ? body.provider.trim() || null : null
  }
  if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
    patch.sort_order = Math.round(body.sort_order)
  }
  if (typeof body.enabled === 'boolean') {
    patch.enabled = body.enabled
  }
  if (typeof body.provisioning_required === 'boolean') {
    patch.provisioning_required = body.provisioning_required
  }
  if (typeof body.embed_enabled === 'boolean') {
    patch.embed_enabled = body.embed_enabled
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('services').update(patch).eq('id', id)

  if (error) {
    console.error('update service failed:', error)
    return NextResponse.json(
      { error: `Could not update service: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}

/** DELETE — remove the service. service_auth_types and site_services cascade. */
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
