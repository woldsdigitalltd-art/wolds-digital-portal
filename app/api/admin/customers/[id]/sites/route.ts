import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AddSiteBody {
  domain?:       string
  display_name?: string
}

// RFC-1035-ish domain check. Stays lenient on TLD length so things like
// .gallery, .technology work; rejects anything with whitespace, scheme,
// path or obviously invalid characters.
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

interface RouteCtx {
  params: Promise<{ id: string }>
}

/**
 * GET — list every site owned by the given customer.
 */
export async function GET(_request: Request, ctx: RouteCtx) {
  const { id: customerId } = await ctx.params

  const guard = await requireAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data: sites, error } = await admin
    .from('sites')
    .select('id, domain, display_name, owner_id, analytics_enabled, uptime_enabled')
    .eq('owner_id', customerId)
    .order('domain', { ascending: true })

  if (error) {
    console.error('admin list sites failed:', error)
    return NextResponse.json(
      { error: `Could not load sites: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ sites: sites ?? [] })
}

/**
 * POST — add a new site for the given customer.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const { id: customerId } = await ctx.params

  const guard = await requireAdmin()
  if (guard) return guard

  let body: AddSiteBody
  try {
    body = (await request.json()) as AddSiteBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const domain = normalizeDomain(body.domain)
  if (!domain) {
    return NextResponse.json(
      { error: 'Please enter a valid domain (e.g. example.com).' },
      { status: 400 }
    )
  }
  if (domain.length > 253) {
    return NextResponse.json({ error: 'Domain is too long.' }, { status: 400 })
  }

  const displayName = trimOrNull(body.display_name)

  const admin = createAdminClient()

  // Verify the customer exists (and isn't soft-deleted / has profile).
  const { data: targetUser, error: userErr } = await admin.auth.admin.getUserById(customerId)
  if (userErr || !targetUser?.user) {
    return NextResponse.json(
      { error: 'Customer not found.' },
      { status: 404 }
    )
  }

  // Reject duplicate domain per owner. (Two different customers can
  // technically own different records of the same domain — we leave
  // global uniqueness to a future schema-level constraint.)
  const { data: existing, error: lookupErr } = await admin
    .from('sites')
    .select('id')
    .eq('owner_id', customerId)
    .eq('domain', domain)
    .maybeSingle()

  if (lookupErr) {
    console.error('site lookup failed:', lookupErr)
    return NextResponse.json(
      { error: `Could not check existing sites: ${lookupErr.message}` },
      { status: 500 }
    )
  }
  if (existing) {
    return NextResponse.json(
      { error: 'This customer already has that domain linked.' },
      { status: 409 }
    )
  }

  const { data: created, error: insertErr } = await admin
    .from('sites')
    .insert({
      owner_id:     customerId,
      domain,
      display_name: displayName,
    })
    .select('id, domain, display_name, owner_id, analytics_enabled, uptime_enabled')
    .single()

  if (insertErr) {
    console.error('site insert failed:', insertErr)
    const detail = insertErr.hint
      ? `${insertErr.message} (${insertErr.hint})`
      : insertErr.message
    return NextResponse.json(
      { error: `Could not add site: ${detail}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ site: created }, { status: 201 })
}

/** Verifies the caller is an authenticated admin. Returns a 401/403 response on failure. */
async function requireAdmin(): Promise<NextResponse | null> {
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

function normalizeDomain(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null
  let domain = raw.trim().toLowerCase()
  if (!domain) return null

  // Strip URL scheme + everything after the path delimiter.
  domain = domain.replace(/^https?:\/\//, '')
  domain = domain.split('/')[0] ?? ''
  // Strip port + leading www.
  domain = domain.split(':')[0] ?? ''
  domain = domain.replace(/^www\./, '')

  return DOMAIN_REGEX.test(domain) ? domain : null
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
