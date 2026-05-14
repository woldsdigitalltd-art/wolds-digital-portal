import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { resolveIncident, dismissIncident, reopenIncident } from '@/lib/incidents/resolve'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** GET /api/incidents/[id] — fetch single incident */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: isAdminFlag } = await supabase.rpc('is_current_user_admin')
  const isAdmin = Boolean(isAdminFlag)

  const sr = createServiceRoleClient()
  const { data: incident, error } = await sr.from('incidents').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!incident) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  if (!isAdmin) {
    const { data: site } = await sr.from('sites').select('owner_id').eq('id', incident.site_id).maybeSingle()
    if (site?.owner_id !== user.id) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  return NextResponse.json(incident)
}

/**
 * PATCH /api/incidents/[id]
 * Body: { action: 'resolve' | 'dismiss' | 'reopen', note?: string, dismiss_reason?: string }
 */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: isAdminFlag } = await supabase.rpc('is_current_user_admin')
  const isAdmin = Boolean(isAdminFlag)

  const sr = createServiceRoleClient()
  const { data: incident, error: loadErr } = await sr.from('incidents').select('site_id').eq('id', id).maybeSingle()
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!incident) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  if (!isAdmin) {
    const { data: site } = await sr.from('sites').select('owner_id').eq('id', incident.site_id).maybeSingle()
    if (site?.owner_id !== user.id) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { action, note, dismiss_reason } = body as {
    action?:         string
    note?:           string
    dismiss_reason?: string
  }

  if (action === 'resolve') {
    await resolveIncident(id, user.id, note)
  } else if (action === 'dismiss') {
    if (!dismiss_reason) return NextResponse.json({ error: 'dismiss_reason is required.' }, { status: 400 })
    // Only admins can dismiss.
    if (!isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
    await dismissIncident(id, user.id, dismiss_reason)
  } else if (action === 'reopen') {
    if (!isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
    await reopenIncident(id)
  } else {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }

  const { data: updated } = await sr.from('incidents').select('*').eq('id', id).maybeSingle()
  return NextResponse.json(updated)
}
