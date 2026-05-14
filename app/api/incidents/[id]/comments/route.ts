import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** GET /api/incidents/[id]/comments */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: isAdminFlag } = await supabase.rpc('is_current_user_admin')
  const isAdmin = Boolean(isAdminFlag)

  const sr = createServiceRoleClient()
  const { data: incident } = await sr.from('incidents').select('site_id').eq('id', id).maybeSingle()
  if (!incident) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  if (!isAdmin) {
    const { data: site } = await sr.from('sites').select('owner_id').eq('id', incident.site_id).maybeSingle()
    if (site?.owner_id !== user.id) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  const { data, error } = await sr
    .from('incident_comments')
    .select('*')
    .eq('incident_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST /api/incidents/[id]/comments — body: { body: string } */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: isAdminFlag } = await supabase.rpc('is_current_user_admin')
  const isAdmin = Boolean(isAdminFlag)

  const sr = createServiceRoleClient()
  const { data: incident } = await sr.from('incidents').select('site_id').eq('id', id).maybeSingle()
  if (!incident) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  if (!isAdmin) {
    const { data: site } = await sr.from('sites').select('owner_id').eq('id', incident.site_id).maybeSingle()
    if (site?.owner_id !== user.id) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!text) return NextResponse.json({ error: 'Comment body is required.' }, { status: 400 })

  const { data: comment, error } = await sr.from('incident_comments').insert({
    incident_id: id,
    author_id:   user.id,
    author_role: isAdmin ? 'admin' : 'customer',
    body:        text,
  }).select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(comment, { status: 201 })
}
