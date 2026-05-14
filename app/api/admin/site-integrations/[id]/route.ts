import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import type { Integration, SiteIntegration } from '@/lib/integrations/types'
import { deleteMonitor } from '@/lib/betterstack'
import { computeNextRun, validateSchedule } from '@/lib/integrations/schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

interface SchedulePatchBody {
  schedule_frequency?:     'off' | 'daily' | 'weekly' | 'monthly'
  schedule_hour?:          number | null
  schedule_day_of_week?:   number | null
  schedule_day_of_month?:  number | null
}

/**
 * PATCH /api/admin/site-integrations/[id]
 *
 * Currently only writes audit-schedule fields. The payload mirrors the
 * `schedule_*` columns on `site_integrations`. `schedule_next_run_at`
 * is derived server-side from the validated input so the cron worker
 * can do a simple `next_run_at <= now()` lookup.
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: SchedulePatchBody
  try {
    body = (await request.json()) as SchedulePatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (body.schedule_frequency === undefined) {
    return NextResponse.json({ error: 'schedule_frequency is required.' }, { status: 400 })
  }

  const v = validateSchedule({
    frequency:    body.schedule_frequency,
    hour:         body.schedule_hour         ?? null,
    day_of_week:  body.schedule_day_of_week  ?? null,
    day_of_month: body.schedule_day_of_month ?? null,
  })
  if (!v.ok || !v.value) {
    return NextResponse.json({ error: v.error ?? 'Invalid schedule.' }, { status: 400 })
  }

  const next = computeNextRun({
    frequency:    v.value.frequency,
    hour:         v.value.hour,
    day_of_week:  v.value.day_of_week,
    day_of_month: v.value.day_of_month,
  })

  const sr = createServiceRoleClient()
  const { data: updated, error } = await sr
    .from('site_integrations')
    .update({
      schedule_frequency:     v.value.frequency,
      schedule_hour:          v.value.hour,
      schedule_day_of_week:   v.value.day_of_week,
      schedule_day_of_month:  v.value.day_of_month,
      schedule_next_run_at:   next?.toISOString() ?? null,
    })
    .eq('id', id)
    .select(`
      id, site_id, integration_id, status,
      provider_resource_id, provider_metadata,
      last_error, provisioned_at,
      created_at, updated_at,
      schedule_frequency, schedule_hour,
      schedule_day_of_week, schedule_day_of_month,
      schedule_last_run_at, schedule_next_run_at,
      integration:integrations ( key, name )
    `)
    .maybeSingle()

  if (error) {
    console.error('schedule update failed:', error)
    return NextResponse.json(
      { error: `Could not update schedule: ${error.message}` },
      { status: 500 },
    )
  }
  if (!updated) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const row = updated as unknown as SiteIntegration & {
    integration: { key: string; name: string } | null
  }

  return NextResponse.json({
    link: {
      ...row,
      integration_key:  row.integration?.key  ?? '',
      integration_name: row.integration?.name ?? '',
    },
  })
}

/**
 * DELETE /api/admin/site-integrations/[id]
 *
 * Removes the integration from the site, calling the provider to
 * deprovision the remote resource first when applicable. If the
 * remote call fails we still log it but go ahead with the row
 * deletion — the spec lets the admin intervene in the provider's UI
 * if they need to fully tidy up an orphan monitor.
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const sr = createServiceRoleClient()

  const { data: row, error: loadErr } = await sr
    .from('site_integrations')
    .select(`
      id, site_id, provider_resource_id, input_values,
      integration:integrations ( key, input_values )
    `)
    .eq('id', id)
    .maybeSingle()

  if (loadErr) {
    console.error('load site integration for delete failed:', loadErr)
    return NextResponse.json(
      { error: `Could not load site integration: ${loadErr.message}` },
      { status: 500 },
    )
  }
  if (!row) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const link        = row as unknown as SiteIntegration & {
    integration: Pick<Integration, 'key' | 'input_values'> | null
  }
  const integration = link.integration
  const monitorId   = link.provider_resource_id

  if (integration?.key === 'google_places') {
    await sr.from('sites').update({ google_place_id: null }).eq('id', link.site_id)
  } else if (integration?.key === 'trustpilot') {
    await sr.from('sites').update({ trustpilot_domain: null }).eq('id', link.site_id)
  } else if (monitorId && integration?.key === 'betterstack') {
    const apiKey = (integration.input_values ?? {})['api_key']
    if (apiKey) {
      try {
        await deleteMonitor(apiKey, monitorId)
      } catch (err) {
        // Log and keep going — the admin can clean up in Better Stack
        // directly if a monitor is already gone or detached.
        console.error('[deprovision betterstack]', err)
      }
    }
  }

  const { error: deleteErr } = await sr
    .from('site_integrations')
    .delete()
    .eq('id', id)

  if (deleteErr) {
    console.error('delete site integration failed:', deleteErr)
    return NextResponse.json(
      { error: `Could not remove integration: ${deleteErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
