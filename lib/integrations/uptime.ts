import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getMonitor } from '@/lib/betterstack'

/**
 * Live Better Stack status for sites that have the integration
 * attached. Read directly from the provider so the portal always
 * shows the truth — no background sync to keep in step.
 */

export interface LiveUptime {
  status:            'up' | 'down' | 'paused' | 'unknown'
  uptime_percentage: number | null
  last_checked_at:   string | null
}

interface MonitorRow {
  site_id:              string
  provider_resource_id: string | null
  integration: {
    key:          string
    input_values: Record<string, string> | null
  } | null
}

/**
 * Returns a Map keyed by site_id with the latest Better Stack snapshot
 * for any site in `siteIds` that has an active betterstack
 * integration. Sites without monitoring are omitted.
 */
export async function fetchUptimeBySite(
  siteIds: string[],
): Promise<Map<string, LiveUptime>> {
  const map = new Map<string, LiveUptime>()
  if (siteIds.length === 0) return map

  const sr = createServiceRoleClient()
  const { data, error } = await sr
    .from('site_integrations')
    .select(`
      site_id, provider_resource_id,
      integration:integrations ( key, input_values )
    `)
    .in('site_id', siteIds)
    .eq('status', 'active')

  if (error) {
    console.error('fetchUptimeBySite: load monitors failed:', error)
    return map
  }

  const rows = (data ?? []) as unknown as MonitorRow[]
  const checks: Promise<void>[] = []

  for (const row of rows) {
    if (row.integration?.key !== 'betterstack') continue
    const apiKey = (row.integration.input_values ?? {})['api_key']
    if (!apiKey || !row.provider_resource_id) continue

    checks.push(
      (async () => {
        try {
          const attrs = await getMonitor(apiKey, row.provider_resource_id!)
          map.set(row.site_id, normaliseStatus(attrs))
        } catch (err) {
          console.error('fetchUptimeBySite: getMonitor failed', err)
          map.set(row.site_id, {
            status:            'unknown',
            uptime_percentage: null,
            last_checked_at:   null,
          })
        }
      })(),
    )
  }

  await Promise.all(checks)
  return map
}

function normaliseStatus(attrs: Record<string, unknown>): LiveUptime {
  const raw = String(attrs.status ?? '').toLowerCase()
  let status: LiveUptime['status'] = 'unknown'
  if (raw === 'up' || raw === 'down' || raw === 'paused') status = raw
  // Better Stack also reports 'validating' / 'maintenance' / 'pending' —
  // we collapse those to 'unknown' so the UI stays simple.

  const availability =
    typeof attrs.availability === 'number' ? attrs.availability
    : typeof attrs.availability === 'string' ? Number.parseFloat(attrs.availability)
    : null

  return {
    status,
    uptime_percentage: availability !== null && Number.isFinite(availability) ? availability : null,
    last_checked_at:   typeof attrs.last_checked_at === 'string' ? attrs.last_checked_at : null,
  }
}
