import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  provisionSiteService,
  deprovisionSiteService,
} from '@/lib/provisioning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/provision-service
 *
 * Body: { action: 'provision' | 'deprovision', site_service_id: string }
 *
 * Admin-only. Internally uses the service role client to read the
 * platform API key from `services.global_settings_data` and to
 * update `site_services` outside RLS.
 *
 * Called by the admin UI:
 *   - right after creating a site_services row (action: provision)
 *   - when removing a service from a site            (action: deprovision)
 *   - to retry after a failed attempt                (action: provision)
 */
interface Body {
  action?:          'provision' | 'deprovision' | string
  site_service_id?: string
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

  const { action, site_service_id } = body

  if (!site_service_id) {
    return NextResponse.json({ error: 'site_service_id is required' }, { status: 400 })
  }
  if (action !== 'provision' && action !== 'deprovision') {
    return NextResponse.json(
      { error: 'action must be "provision" or "deprovision"' },
      { status: 400 },
    )
  }

  try {
    if (action === 'provision') {
      const result = await provisionSiteService(site_service_id)
      return NextResponse.json(result)
    } else {
      await deprovisionSiteService(site_service_id)
      return NextResponse.json({ status: 'cancelled' })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provisioning failed'
    console.error('[provision-service]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
