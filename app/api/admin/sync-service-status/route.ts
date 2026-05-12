import { NextResponse }            from 'next/server'
import { createClient }            from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getUptimeMonitorStatus }  from '@/lib/provisioning/providers/betterstack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/sync-service-status?site_service_id=xxx
 *
 * Pulls the current live status from the provider and merges it
 * into `site_services.provider_metadata`. Admin only.
 *
 * Currently supports: uptime / ssl (Better Stack). Extend the switch
 * below for new providers.
 */

interface JoinedService {
  key:                  string
  global_settings_data: Record<string, unknown> | null
}

export async function GET(request: Request) {
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const siteServiceId    = searchParams.get('site_service_id')
  if (!siteServiceId) {
    return NextResponse.json({ error: 'site_service_id is required' }, { status: 400 })
  }

  const sr = createServiceRoleClient()
  const { data: ss, error } = await sr
    .from('site_services')
    .select(`
      id,
      provider_resource_id,
      service:services (
        key,
        global_settings_data
      )
    `)
    .eq('id', siteServiceId)
    .single()

  if (error || !ss) {
    return NextResponse.json({ error: 'site_service not found' }, { status: 404 })
  }

  const service        = ss.service as unknown as JoinedService | null
  const globalSettings = (service?.global_settings_data ?? {}) as Record<string, unknown>
  const apiKey         = globalSettings.api_key as string | undefined
  const monitorId      = ss.provider_resource_id as string | null

  if (!service)   return NextResponse.json({ error: 'service join missing' }, { status: 500 })
  if (!monitorId) return NextResponse.json({ error: 'No provider resource to sync' }, { status: 400 })

  try {
    let liveStatus: Record<string, unknown> = {}

    switch (service.key) {
      case 'uptime':
      case 'ssl': {
        if (!apiKey) throw new Error('Better Stack API key not configured.')
        liveStatus = await getUptimeMonitorStatus({ apiKey, monitorId })
        break
      }
      default:
        return NextResponse.json(
          { error: `No status sync implemented for service "${service.key}"` },
          { status: 400 },
        )
    }

    await sr
      .from('site_services')
      .update({ provider_metadata: liveStatus })
      .eq('id', siteServiceId)

    return NextResponse.json({ synced: true, ...liveStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed.'
    console.error('[sync-service-status]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
