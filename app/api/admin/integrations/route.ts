import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import type { Integration } from '@/lib/integrations/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KEY_REGEX = /^[a-z][a-z0-9_-]{1,62}$/

/**
 * Columns we ever return to the client. Crucially this set never
 * includes `credentials` — those stay on the server. The service
 * role can read them, the browser never should.
 */
const SAFE_COLUMNS = `
  id, key, name, description, icon, provider, provider_url,
  provisioning_required, embed_enabled, enabled, sort_order,
  created_at, updated_at
`

/** GET — list every integration offering. */
export async function GET() {
  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('integrations')
    .select(SAFE_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) {
    console.error('list integrations failed:', error)
    return NextResponse.json(
      { error: `Could not load integrations: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ integrations: (data ?? []) as Integration[] })
}

interface CreateBody {
  key?:                   string
  name?:                  string
  description?:           string | null
  icon?:                  string | null
  provider?:              string | null
  provider_url?:          string | null
  provisioning_required?: boolean
  embed_enabled?:         boolean
  enabled?:               boolean
  sort_order?:            number
}

/**
 * POST — create a new integration. Credentials live in a separate
 * column and are set directly in the DB; nothing about them is
 * accepted here.
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
      { status: 400 },
    )
  }
  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }

  const insert: Record<string, unknown> = {
    key,
    name,
    description:           typeof body.description === 'string' ? body.description.trim() || null : null,
    icon:                  typeof body.icon        === 'string' ? body.icon.trim()        || null : null,
    provider:              typeof body.provider    === 'string' ? body.provider.trim()    || null : null,
    provider_url:          typeof body.provider_url === 'string' ? body.provider_url.trim() || null : null,
    sort_order:            Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
    enabled:               body.enabled !== false,
    provisioning_required: body.provisioning_required === true,
    embed_enabled:         body.embed_enabled === true,
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('integrations')
    .insert(insert)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'An integration with that key already exists.' },
        { status: 409 },
      )
    }
    console.error('create integration failed:', error)
    return NextResponse.json(
      { error: `Could not create integration: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
