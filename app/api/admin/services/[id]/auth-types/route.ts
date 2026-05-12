import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import { isAuthType, normalizeSchema } from '@/lib/services/types'
import type { AuthType, ServiceAuthType } from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

interface CreateBody {
  auth_type?:       AuthType | string
  label?:           string
  description?:     string | null
  settings_schema?: unknown
  is_default?:      boolean
  sort_order?:      number
}

/**
 * POST — create a new auth option for a service. If marked
 * `is_default`, any existing default for the same service is demoted
 * first so the invariant "at most one default per service" holds.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const { id: serviceId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!isAuthType(body.auth_type)) {
    return NextResponse.json(
      { error: 'auth_type must be one of platform_key, oauth_client, oauth_platform, manual.' },
      { status: 400 }
    )
  }
  const label = (body.label ?? '').trim()
  if (!label) {
    return NextResponse.json({ error: 'Label is required.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error: serviceErr, count } = await admin
    .from('services')
    .select('id', { head: true, count: 'exact' })
    .eq('id', serviceId)
  if (serviceErr || !count) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 })
  }

  const wantsDefault = body.is_default === true

  if (wantsDefault) {
    const { error: demoteErr } = await admin
      .from('service_auth_types')
      .update({ is_default: false })
      .eq('service_id', serviceId)
      .eq('is_default', true)
    if (demoteErr) {
      console.error('demote default auth option failed:', demoteErr)
    }
  }

  const insert: Record<string, unknown> = {
    service_id:      serviceId,
    auth_type:       body.auth_type,
    label,
    description:     typeof body.description === 'string' ? body.description.trim() || null : null,
    settings_schema: normalizeSchema(body.settings_schema),
    is_default:      wantsDefault,
    sort_order:      Number.isFinite(body.sort_order) ? Math.round(Number(body.sort_order)) : 0,
  }

  const { data, error } = await admin
    .from('service_auth_types')
    .insert(insert)
    .select('*')
    .single()

  if (error) {
    console.error('create auth option failed:', error)
    return NextResponse.json(
      { error: `Could not create auth option: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ auth_option: data as ServiceAuthType }, { status: 201 })
}
