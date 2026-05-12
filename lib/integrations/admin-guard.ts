import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Re-checks admin status server-side for /api/admin/* routes.
 * Returns null on success, or a NextResponse to send back on failure.
 */
export async function requireApiAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }
  const { data: isAdmin, error } = await supabase.rpc('is_current_user_admin')
  if (error) {
    console.error('admin check failed:', error)
    return NextResponse.json({ error: 'Admin check failed.' }, { status: 500 })
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
  }
  return null
}
