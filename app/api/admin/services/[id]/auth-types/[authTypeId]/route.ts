import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import { isAuthType, normalizeSchema } from '@/lib/services/types'
import type { AuthType, ServiceAuthType } from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string; authTypeId: string }>
}

interface PatchBody {
  auth_type?:       AuthType | string
  label?:           string
  description?:     string | null
  settings_schema?: unknown
  is_default?:      boolean
  sort_order?:      number
}

/** GET — return one auth option by id. */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: serviceId, authTypeId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_auth_types')
    .select('*')
    .eq('service_id', serviceId)
    .eq('id',         authTypeId)
    .maybeSingle()

  if (error) {
    console.error('get auth option failed:', error)
    return NextResponse.json(
      { error: `Could not load auth option: ${error.message}` },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'Auth option not found.' }, { status: 404 })
  }
  return NextResponse.json({ auth_option: data as ServiceAuthType })
}

/**
 * PATCH — update fields on an existing auth option. If promoting this
 * option to default, any other defaults for the same service are
 * demoted first.
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const { id: serviceId, authTypeId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (body.auth_type !== undefined) {
    if (!isAuthType(body.auth_type)) {
      return NextResponse.json({ error: 'Invalid auth_type.' }, { status: 400 })
    }
    patch.auth_type = body.auth_type
  }
  if (typeof body.label === 'string') {
    const t = body.label.trim()
    if (!t) return NextResponse.json({ error: 'Label cannot be empty.' }, { status: 400 })
    patch.label = t
  }
  if (typeof body.description === 'string' || body.description === null) {
    patch.description =
      typeof body.description === 'string' ? body.description.trim() || null : null
  }
  if (body.settings_schema !== undefined) {
    patch.settings_schema = normalizeSchema(body.settings_schema)
  }
  if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
    patch.sort_order = Math.round(body.sort_order)
  }

  if (Object.keys(patch).length === 0 && body.is_default === undefined) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (body.is_default === true) {
    await admin
      .from('service_auth_types')
      .update({ is_default: false })
      .eq('service_id', serviceId)
      .neq('id', authTypeId)
    patch.is_default = true
  } else if (body.is_default === false) {
    patch.is_default = false
  }

  const { error } = await admin
    .from('service_auth_types')
    .update(patch)
    .eq('service_id', serviceId)
    .eq('id',         authTypeId)

  if (error) {
    console.error('update auth option failed:', error)
    return NextResponse.json(
      { error: `Could not update auth option: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}

/** DELETE — remove an auth option. site_services with this auth_type_id will have it set to null (FK ON DELETE SET NULL assumed). */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id: serviceId, authTypeId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { error } = await admin
    .from('service_auth_types')
    .delete()
    .eq('service_id', serviceId)
    .eq('id',         authTypeId)

  if (error) {
    console.error('delete auth option failed:', error)
    return NextResponse.json(
      { error: `Could not delete auth option: ${error.message}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
