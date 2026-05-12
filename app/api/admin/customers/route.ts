import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTransactionalEmail } from '@/lib/brevo'
import { renderMagicLinkEmail } from '@/lib/emails/magic-link'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CreateCustomerBody {
  email:         string
  full_name?:    string
  company_name?: string
  phone?:        string
  send_invite?:  boolean
}

export async function POST(request: Request) {
  // 1. Auth: caller must be an admin.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }
  const { data: isAdmin, error: adminErr } = await supabase.rpc('is_current_user_admin')
  if (adminErr) {
    console.error('admin check failed:', adminErr)
    return NextResponse.json({ error: 'Admin check failed.' }, { status: 500 })
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
  }

  // 2. Parse + validate body.
  let body: CreateCustomerBody
  try {
    body = (await request.json()) as CreateCustomerBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const fullName    = trimOrNull(body.full_name)
  const companyName = trimOrNull(body.company_name)
  const phone       = trimOrNull(body.phone)
  const sendInvite  = body.send_invite !== false  // default true

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (sendInvite && !siteUrl) {
    console.error('NEXT_PUBLIC_SITE_URL is not configured.')
    return NextResponse.json({ error: 'Server is misconfigured.' }, { status: 500 })
  }

  const admin = createAdminClient()

  // 3. Create the auth user. email_confirm=true so they don't need a
  //    separate confirmation step — clicking the invite magic link is
  //    enough to prove ownership.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name:    fullName,
      company_name: companyName,
    },
  })

  if (createErr) {
    const msg = createErr.message ?? ''
    // Supabase returns 422 with this message when the email already exists.
    if (/already (registered|exists)/i.test(msg) || createErr.status === 422) {
      return NextResponse.json(
        { error: 'A user with that email already exists.' },
        { status: 409 }
      )
    }
    console.error('createUser failed:', createErr)
    return NextResponse.json({ error: `Could not create user: ${msg || 'unknown error'}` }, { status: 500 })
  }

  const newUser = created.user
  if (!newUser) {
    return NextResponse.json({ error: 'User was not created.' }, { status: 500 })
  }

  // 4. Upsert the profile row. We use the admin client so RLS doesn't
  //    get in the way. is_admin defaults to false via the column default.
  //
  //    Build the patch dynamically so we only send columns we have
  //    values for — avoids ever overwriting an existing row's data
  //    with NULL if a trigger has already populated it.
  const profilePatch: Record<string, unknown> = { id: newUser.id }
  if (fullName    !== null) profilePatch.full_name    = fullName
  if (companyName !== null) profilePatch.company_name = companyName
  if (phone       !== null) profilePatch.phone        = phone

  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(profilePatch, { onConflict: 'id' })

  if (profileErr) {
    console.error('profile upsert failed:', profileErr)
    // Roll back the auth user so the admin can retry cleanly.
    await admin.auth.admin.deleteUser(newUser.id).catch(err =>
      console.error('rollback deleteUser failed:', err)
    )
    const detail = profileErr.message
      ? `${profileErr.message}${profileErr.hint ? ` (${profileErr.hint})` : ''}`
      : 'unknown database error'
    return NextResponse.json(
      { error: `Could not create customer profile: ${detail}` },
      { status: 500 }
    )
  }

  // 5. Optionally send the branded invitation email via Brevo.
  let inviteSent = false
  if (sendInvite) {
    try {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type:    'magiclink',
        email,
        options: { redirectTo: `${siteUrl!.replace(/\/$/, '')}/auth/callback` },
      })

      const hashedToken = linkData?.properties?.hashed_token
      if (linkErr || !hashedToken) {
        throw new Error(`generateLink failed: ${linkErr?.message ?? 'no token'}`)
      }

      const callbackUrl = new URL('/auth/callback', siteUrl!)
      callbackUrl.searchParams.set('token_hash', hashedToken)
      callbackUrl.searchParams.set('type',       'magiclink')
      callbackUrl.searchParams.set('next',       '/portal')

      const { subject, html, text } = renderMagicLinkEmail({
        magicLink:      callbackUrl.toString(),
        recipientEmail: email,
        variant:        'invite',
      })

      await sendTransactionalEmail({
        to:          [{ email, name: fullName ?? undefined }],
        subject,
        htmlContent: html,
        textContent: text,
        tags:        ['invite', 'auth'],
      })

      inviteSent = true
    } catch (err) {
      // The customer was created successfully — log the email failure
      // but still report success so the admin can resend later if needed.
      console.error('Invitation email failed:', err)
    }
  }

  return NextResponse.json(
    {
      customer: {
        id:           newUser.id,
        email,
        full_name:    fullName,
        company_name: companyName,
        phone,
        created_at:   newUser.created_at,
      },
      invite_sent: inviteSent,
    },
    { status: 201 }
  )
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
