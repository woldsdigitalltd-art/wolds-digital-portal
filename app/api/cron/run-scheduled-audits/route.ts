import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isAuditIntegrationKey, runAuditForKey } from '@/lib/integrations/audits'
import { computeNextRun } from '@/lib/integrations/schedule'
import type { ScheduleFrequency } from '@/lib/integrations/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes — accommodate slow audits.

/**
 * GET /api/cron/run-scheduled-audits
 *
 * Hit by Vercel Cron once per hour. Looks for site_integrations whose
 * `schedule_next_run_at` has passed and re-runs the audit, then bumps
 * `schedule_next_run_at` to the next firing per the row's frequency.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. The
 * secret is set in env. Reject anything else so the endpoint can't be
 * triggered externally.
 */

interface DueRow {
  id:                    string
  site_id:               string
  status:                string
  schedule_frequency:    ScheduleFrequency
  schedule_hour:         number | null
  schedule_day_of_week:  number | null
  schedule_day_of_month: number | null
  integration: {
    key:          string
    name:         string
    input_values: Record<string, string> | null
  } | null
  site: { domain: string } | null
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const auth = request.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
  }

  const sr  = createServiceRoleClient()
  const now = new Date()

  const { data, error } = await sr
    .from('site_integrations')
    .select(`
      id, site_id, status,
      schedule_frequency, schedule_hour,
      schedule_day_of_week, schedule_day_of_month,
      integration:integrations ( key, name, input_values ),
      site:sites ( domain )
    `)
    .neq('schedule_frequency', 'off')
    .lte('schedule_next_run_at', now.toISOString())

  if (error) {
    console.error('cron/scheduled-audits: load failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ((data ?? []) as unknown as DueRow[])
    .filter(r => isAuditIntegrationKey(r.integration?.key ?? ''))

  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  // Run sequentially so a backlog of N audits can't fan out beyond the
  // function's CPU/memory envelope. Audits are network-bound but each
  // can take a few seconds.
  for (const row of rows) {
    try {
      const key    = row.integration?.key ?? ''
      const apiKey = row.integration?.input_values?.api_key ?? ''
      const domain = row.site?.domain ?? ''
      if (!isAuditIntegrationKey(key) || !apiKey || !domain) {
        throw new Error('Misconfigured schedule (missing key, secret, or domain).')
      }

      const url   = domain.startsWith('http') ? domain : `https://${domain}`
      const audit = await runAuditForKey(key, apiKey, url)

      const nextRun = computeNextRun({
        frequency:    row.schedule_frequency,
        hour:         row.schedule_hour,
        day_of_week:  row.schedule_day_of_week,
        day_of_month: row.schedule_day_of_month,
      }, new Date())

      await sr
        .from('site_integrations')
        .update({
          status:               'active',
          provider_metadata:    audit.result,
          last_error:           null,
          schedule_last_run_at: new Date().toISOString(),
          schedule_next_run_at: nextRun?.toISOString() ?? null,
        })
        .eq('id', row.id)

      results.push({ id: row.id, ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audit failed.'
      console.error(`[cron/scheduled-audits] ${row.id}:`, err)

      // Still bump next_run_at so a failing audit doesn't get retried
      // every minute — we wait until the next scheduled firing.
      const nextRun = computeNextRun({
        frequency:    row.schedule_frequency,
        hour:         row.schedule_hour,
        day_of_week:  row.schedule_day_of_week,
        day_of_month: row.schedule_day_of_month,
      }, new Date())

      await sr
        .from('site_integrations')
        .update({
          status:               'error',
          last_error:           message,
          schedule_last_run_at: new Date().toISOString(),
          schedule_next_run_at: nextRun?.toISOString() ?? null,
        })
        .eq('id', row.id)

      results.push({ id: row.id, ok: false, error: message })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
