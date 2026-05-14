import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/incidents?site_id=…&status=open|resolved|dismissed
 *
 * Returns incidents for the current user's sites (or all sites if admin).
 * Service-role is used to read so RLS doesn't need to be threaded through.
 * Authorisation is enforced here explicitly.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: isAdminFlag } = await supabase.rpc('is_current_user_admin')
  const isAdmin = Boolean(isAdminFlag)

  const url    = new URL(request.url)
  const siteId = url.searchParams.get('site_id')
  const status = url.searchParams.get('status')

  const sr = createServiceRoleClient()
  let query = sr
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })

  if (siteId) {
    // Verify authorisation for this specific site.
    if (!isAdmin) {
      const { data: site } = await sr.from('sites').select('owner_id').eq('id', siteId).maybeSingle()
      if (site?.owner_id !== user.id) {
        return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
      }
    }
    query = query.eq('site_id', siteId)
  } else if (!isAdmin) {
    // No site_id filter — scope to all sites owned by this user.
    const { data: sites } = await sr.from('sites').select('id').eq('owner_id', user.id)
    const ids = (sites ?? []).map(s => s.id)
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('site_id', ids)
  }

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
