import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { ScheduleFrequency } from '@/lib/integrations/types'

export interface AuditScheduleInfo {
  frequency:    ScheduleFrequency
  hour:         number | null
  day_of_week:  number | null
  day_of_month: number | null
  last_run_at:  string | null
  next_run_at:  string | null
}

/**
 * Read the audit schedule for a single (site, integration-key) pair.
 * Returns null when the integration isn't attached or no schedule has
 * been configured yet.
 *
 * Used by the per-tab pages (SEO / Performance / Broken Links) to
 * surface "next audit at …" alongside the cached report. Lives in its
 * own server-only file so the pure helpers in `./schedule.ts` stay
 * client-safe.
 */
export async function loadAuditSchedule(
  siteId: string,
  key:    'seoscoreapi' | 'pagespeed' | 'brokenlinks',
): Promise<AuditScheduleInfo | null> {
  const sr = createServiceRoleClient()
  const { data, error } = await sr
    .from('site_integrations')
    .select(`
      schedule_frequency, schedule_hour,
      schedule_day_of_week, schedule_day_of_month,
      schedule_last_run_at, schedule_next_run_at,
      integration:integrations ( key )
    `)
    .eq('site_id', siteId)
    .eq('status', 'active')

  if (error) {
    console.error('loadAuditSchedule: load failed', error)
    return null
  }

  type Row = {
    schedule_frequency:    ScheduleFrequency
    schedule_hour:         number | null
    schedule_day_of_week:  number | null
    schedule_day_of_month: number | null
    schedule_last_run_at:  string | null
    schedule_next_run_at:  string | null
    integration:           { key: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]
  const row  = rows.find(r => r.integration?.key === key)
  if (!row) return null

  return {
    frequency:    row.schedule_frequency,
    hour:         row.schedule_hour,
    day_of_week:  row.schedule_day_of_week,
    day_of_month: row.schedule_day_of_month,
    last_run_at:  row.schedule_last_run_at,
    next_run_at:  row.schedule_next_run_at,
  }
}
