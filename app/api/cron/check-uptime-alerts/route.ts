import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getMonitor } from '@/lib/betterstack'
import { evaluateUptimeRules } from '@/lib/incidents/rules/uptime'
import type { LiveUptime } from '@/lib/integrations/uptime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/check-uptime-alerts
 *
 * Hit by Vercel Cron every hour. Fetches live Better Stack status for
 * every site with an active betterstack integration, then evaluates
 * uptime incident rules (raise alert if down, auto-resolve if back up).
 */

interface MonitorRow {
  site_id:              string
  provider_resource_id: string | null
  integration: {
    key:          string
    input_values: Record<string, string> | null
  } | null
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const auth = request.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
  }

  const sr = createServiceRoleClient()
  const { data, error } = await sr
    .from('site_integrations')
    .select(`
      site_id, provider_resource_id,
      integration:integrations ( key, input_values )
    `)
    .eq('status', 'active')

  if (error) {
    console.error('check-uptime-alerts: load failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ((data ?? []) as unknown as MonitorRow[])
    .filter(r => r.integration?.key === 'betterstack')

  const results: Array<{ site_id: string; ok: boolean; status?: string; error?: string }> = []

  for (const row of rows) {
    const apiKey = (row.integration?.input_values ?? {})['api_key']
    if (!apiKey || !row.provider_resource_id) continue

    try {
      const attrs = await getMonitor(apiKey, row.provider_resource_id)
      const raw   = String(attrs.status ?? '').toLowerCase()
      let status: LiveUptime['status'] = 'unknown'
      if (raw === 'up' || raw === 'down' || raw === 'paused') status = raw

      await evaluateUptimeRules(row.site_id, {
        status,
        uptime_percentage: null,
        last_checked_at:   null,
      })

      results.push({ site_id: row.site_id, ok: true, status })
    } catch (err) {
      console.error(`check-uptime-alerts [${row.site_id}]:`, err)
      results.push({
        site_id: row.site_id,
        ok:      false,
        error:   err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({ checked: results.length, results })
}
