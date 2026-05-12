import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Auth callback for magic links and email confirmations.
 *
 * We support two flows here:
 *
 * 1. `token_hash` + `type` — used by magic links generated server-side
 *    via `auth.admin.generateLink` and delivered through Brevo. We
 *    verify the OTP server-side, which sets the session cookies and
 *    lets us redirect cleanly.
 *
 * 2. `code` — used by the standard PKCE flow (e.g. password reset
 *    links or OAuth). Kept as a fallback for compatibility.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = sanitizeNext(url.searchParams.get('next'))

  const tokenHash = url.searchParams.get('token_hash')
  const type      = url.searchParams.get('type') as EmailOtpType | null
  const code      = url.searchParams.get('code')

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
    console.error('verifyOtp failed:', error)
    return NextResponse.redirect(new URL('/?error=auth', url.origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
    console.error('exchangeCodeForSession failed:', error)
  }

  return NextResponse.redirect(new URL('/?error=auth', url.origin))
}

/** Only allow same-origin paths so the `next` param can't be used as an open redirect. */
function sanitizeNext(raw: string | null): string {
  if (!raw) return '/portal'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/portal'
  return raw
}
