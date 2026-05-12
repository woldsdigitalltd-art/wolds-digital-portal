import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import type { ServiceWithAuth } from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KEY_REGEX = /^[a-z][a-z0-9_-]{1,62}$/

/**
 * GET — list every service offering with its auth options. Reads from
 * the `services_with_auth` view so the row already includes a fully-
 * populated `auth_options` array.
 */
export async function GET() {
  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services_with_auth')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) {
    console.error('list services failed:', error)
    return NextResponse.json(
      { error: `Could not load services: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ services: (data ?? []) as ServiceWithAuth[] })
}

interface CreateBody {
  key?:                   string
  name?:                  string
  description?:           string | null
  icon?:                  string | null
  sort_order?:            number
  enabled?:               boolean
  provider?:              string | null
  provisioning_required?: boolean
  embed_enabled?:         boolean
}

/**
 * POST — create a new service. Auth options are managed separately at
 * /api/admin/services/[id]/auth-types, so the newly created service
 * has no usable auth methods until at least one is added.
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

  const admin = createAdminClient()
  const insert: Record<string, unknown> = {
    key,
    name,
    description: typeof body.description === 'string' ? body.description.trim() || null : null,
    icon:        typeof body.icon        === 'string' ? body.icon.trim()        || null : null,
    provider:    typeof body.provider    === 'string' ? body.provider.trim()    || null : null,
    sort_order:  Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
    enabled:     body.enabled !== false,
  }
  if (typeof body.provisioning_required === 'boolean') {
    insert.provisioning_required = body.provisioning_required
  }
  if (typeof body.embed_enabled === 'boolean') {
    insert.embed_enabled = body.embed_enabled
  }

  const { data, error } = await admin
    .from('services')
    .insert(insert)
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
