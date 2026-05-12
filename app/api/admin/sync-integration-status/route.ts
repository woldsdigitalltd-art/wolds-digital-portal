import { NextResponse }            from 'next/server'
import { createClient }            from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getUptimeMonitorStatus }  from '@/lib/provisioning/providers/betterstack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/sync-integration-status?site_integration_id=xxx
 *
 * Pulls the current live status from the provider and merges it into
 * `site_integrations.provider_metadata`. Admin only.
 *
 * Currently supports uptime / ssl via Better Stack. Extend the
 * switch below for new providers.
 */

interface JoinedIntegration {
  key:         string
  credentials: Record<string, unknown> | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams }    = new URL(request.url)
  const siteIntegrationId   = searchParams.get('site_integration_id')
  if (!siteIntegrationId) {
    return NextResponse.json({ error: 'site_integration_id is required' }, { status: 400 })
  }

  const sr = createServiceRoleClient()
  const { data: si, error } = await sr
    .from('site_integrations')
    .select(`
      id,
      provider_resource_id,
      integration:integrations (
        key,
        credentials
      )
    `)
    .eq('id', siteIntegrationId)
    .single()

  if (error || !si) {
    return NextResponse.json({ error: 'site_integration not found' }, { status: 404 })
  }

  const integration   = si.integration as unknown as JoinedIntegration | null
  const platformCreds = (integration?.credentials ?? {}) as Record<string, unknown>
  const apiKey        = platformCreds.api_key as string | undefined
  const monitorId     = si.provider_resource_id as string | null

  if (!integration) return NextResponse.json({ error: 'integration join missing'   }, { status: 500 })
  if (!monitorId)   return NextResponse.json({ error: 'No provider resource to sync' }, { status: 400 })

  try {
    let liveStatus: Record<string, unknown> = {}

    switch (integration.key) {
      case 'uptime':
      case 'ssl': {
        if (!apiKey) throw new Error('Better Stack API key not configured.')
        liveStatus = await getUptimeMonitorStatus({ apiKey, monitorId })
        break
      }
      default:
        return NextResponse.json(
          { error: `No status sync implemented for integration "${integration.key}"` },
          { status: 400 },
        )
    }

    await sr
      .from('site_integrations')
      .update({ provider_metadata: liveStatus })
      .eq('id', siteIntegrationId)

    return NextResponse.json({ synced: true, ...liveStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed.'
    console.error('[sync-integration-status]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
