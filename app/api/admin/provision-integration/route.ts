import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  provisionSiteIntegration,
  deprovisionSiteIntegration,
} from '@/lib/provisioning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/provision-integration
 *
 * Body: { action: 'provision' | 'deprovision', site_integration_id: string }
 *
 * Admin-only. Internally uses the service role client so it can read
 * the platform API key from `integrations.credentials` and update
 * `site_integrations` outside RLS.
 */
interface Body {
  action?:              'provision' | 'deprovision' | string
  site_integration_id?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, site_integration_id } = body
  if (!site_integration_id) {
    return NextResponse.json({ error: 'site_integration_id is required' }, { status: 400 })
  }
  if (action !== 'provision' && action !== 'deprovision') {
    return NextResponse.json(
      { error: 'action must be "provision" or "deprovision"' },
      { status: 400 },
    )
  }

  try {
    if (action === 'provision') {
      const result = await provisionSiteIntegration(site_integration_id)
      return NextResponse.json(result)
    } else {
      await deprovisionSiteIntegration(site_integration_id)
      return NextResponse.json({ status: 'cancelled' })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provisioning failed'
    console.error('[provision-integration]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
