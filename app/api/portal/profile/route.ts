import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/portal/profile
 *
 * Updates the caller's own `profiles` row. Identity is taken from the
 * signed-in session (cookies) and we deliberately ignore any `id` in
 * the body so a user can't impersonate someone else by passing one in.
 *
 * The write goes through the service-role client so it works whether
 * or not the per-column RLS grants in `20260520_profiles_self_service.sql`
 * are applied — RLS is bypassed and column-level grants don't apply
 * to service_role. `is_admin` is never accepted from the request body,
 * so this route can't be used to escalate privileges.
 */

interface Body {
  full_name?:    string | null
  company_name?: string | null
  phone?:        string | null
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Whitelist: only contact fields. Anything else (is_admin, id, etc.)
  // is silently dropped.
  const patch = {
    full_name:    trimOrNull(body.full_name),
    company_name: trimOrNull(body.company_name),
    phone:        trimOrNull(body.phone),
  }

  const sr = createServiceRoleClient()

  const { data, error } = await sr
    .from('profiles')
    .upsert({ id: user.id, ...patch }, { onConflict: 'id' })
    .select('full_name, company_name, phone')
    .single()

  if (error) {
    console.error('update own profile failed:', error)
    return NextResponse.json(
      { error: `Could not save profile: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ profile: data })
}
