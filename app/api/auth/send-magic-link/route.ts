import { NextResponse } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTransactionalEmail } from '@/lib/brevo'
import { renderMagicLinkEmail } from '@/lib/emails/magic-link'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Per-email throttle. Lives in module scope so it persists across requests
// within the same warm lambda. Cold starts reset it, which is fine — the
// purpose is just to stop trivial flood-the-button abuse.
const RECENT_SENDS = new Map<string, number>()
const THROTTLE_MS = 30_000

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const rawEmail = (body as { email?: unknown })?.email
  if (typeof rawEmail !== 'string') {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  // Throttle: 1 send / 30s per email address
  const last = RECENT_SENDS.get(email)
  if (last && Date.now() - last < THROTTLE_MS) {
    return NextResponse.json(
      { error: 'A link was just sent. Please wait a moment before trying again.' },
      { status: 429 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    console.error('NEXT_PUBLIC_SITE_URL is not configured.')
    return NextResponse.json({ error: 'Server is misconfigured.' }, { status: 500 })
  }
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/auth/callback`

  const admin = createAdminClient()

  // 1. Confirm the email is actually registered before generating anything.
  //    Without this, generateLink({ type: 'magiclink' }) would silently
  //    create a new account. The `auth` schema isn't exposed through
  //    PostgREST, so we have to use the GoTrue admin API instead.
  try {
    const exists = await userExistsByEmail(admin, email)
    if (!exists) {
      return NextResponse.json(
        {
          error:
            "We couldn't find an account for that email. Please contact your account manager to be invited.",
        },
        { status: 404 }
      )
    }
  } catch (err) {
    console.error('User lookup failed:', err)
    return NextResponse.json(
      { error: 'Unable to verify your account right now. Please try again.' },
      { status: 500 }
    )
  }

  // 2. Generate the magic link via the Supabase admin client. This does NOT
  //    trigger Supabase's own email sending — it just returns the link,
  //    which we then deliver via Brevo.
  //
  //    We deliberately ignore `data.properties.action_link` (which would
  //    bounce through Supabase's /auth/v1/verify endpoint and hand the
  //    session back to the browser via a URL fragment — useless to a
  //    server route handler). Instead we route directly to our own
  //    /auth/callback with `token_hash` + `type`, and verify it
  //    server-side via supabase.auth.verifyOtp, which sets cookies
  //    properly.
  let magicLink: string
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })

    const hashedToken = data?.properties?.hashed_token
    if (error || !hashedToken) {
      console.error('Supabase generateLink failed:', error)
      return NextResponse.json(
        { error: 'Unable to generate sign-in link. Please try again.' },
        { status: 500 }
      )
    }

    const callbackUrl = new URL('/auth/callback', siteUrl)
    callbackUrl.searchParams.set('token_hash', hashedToken)
    callbackUrl.searchParams.set('type', 'magiclink')
    callbackUrl.searchParams.set('next', '/portal')
    magicLink = callbackUrl.toString()
  } catch (err) {
    console.error('Supabase admin client error:', err)
    return NextResponse.json({ error: 'Unable to generate sign-in link.' }, { status: 500 })
  }

  // Send the branded email via Brevo
  try {
    const { subject, html, text } = renderMagicLinkEmail({
      magicLink,
      recipientEmail: email,
    })
    await sendTransactionalEmail({
      to:          [{ email }],
      subject,
      htmlContent: html,
      textContent: text,
      tags:        ['magic-link', 'auth'],
    })
  } catch (err) {
    console.error('Brevo send failed:', err)
    return NextResponse.json({ error: 'Could not send sign-in email. Please try again.' }, { status: 502 })
  }

  RECENT_SENDS.set(email, Date.now())
  // Opportunistic cleanup so the map can't grow unbounded
  if (RECENT_SENDS.size > 1000) {
    const cutoff = Date.now() - THROTTLE_MS
    for (const [k, v] of RECENT_SENDS) if (v < cutoff) RECENT_SENDS.delete(k)
  }

  return NextResponse.json({ ok: true })
}

/**
 * Checks if a user with the given email exists in Supabase Auth.
 * Uses the GoTrue admin API (`/auth/v1/admin/users`) via paginated
 * listUsers, which is the only documented way to look up a user by
 * email — supabase-js doesn't expose a `getUserByEmail` method.
 *
 * For small client portals this is one API call. Scales to ~1k users
 * per page; we paginate beyond that just in case.
 */
async function userExistsByEmail(admin: SupabaseClient, email: string): Promise<boolean> {
  const target = email.toLowerCase()
  const perPage = 1000
  let page = 1

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    if (data.users.some(u => u.email?.toLowerCase() === target)) {
      return true
    }
    if (data.users.length < perPage) {
      return false
    }
    page++
  }
}
