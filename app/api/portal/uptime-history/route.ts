import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getMonitorIncidents, type MonitorIncident } from '@/lib/betterstack'
import type {
  UptimeHistoryBucket,
  UptimeHistoryRange as Range,
  UptimeHistoryResponse,
} from '@/lib/integrations/uptime-history'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const url    = new URL(request.url)
  const siteId = url.searchParams.get('siteId')
  const range  = (url.searchParams.get('range') ?? 'week') as Range
  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required.' }, { status: 400 })
  }
  if (range !== 'day' && range !== 'week' && range !== 'month') {
    return NextResponse.json({ error: 'invalid range.' }, { status: 400 })
  }

  // Authorise: admin OR site owner. The sites table has RLS that blocks
  // direct reads from authenticated users (the portal uses the
  // `get_my_websites` SECURITY DEFINER RPC), so we check ownership via
  // the service-role client.
  const sr = createServiceRoleClient()
  const [{ data: isAdminFlag }, { data: siteRow }] = await Promise.all([
    supabase.rpc('is_current_user_admin'),
    sr.from('sites').select('owner_id').eq('id', siteId).maybeSingle(),
  ])
  const isAdmin = Boolean(isAdminFlag)
  const isOwner = siteRow?.owner_id === user.id
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  // Load the Better Stack link for this site. A site can have multiple
  // active `site_integrations` rows (one per service), so we fetch all
  // active rows and pick the betterstack one in JS — `.maybeSingle()`
  // would error here when more than one row matches.
  const { data: links, error } = await sr
    .from('site_integrations')
    .select(`
      provider_resource_id,
      integration:integrations ( key, input_values )
    `)
    .eq('site_id', siteId)
    .eq('status', 'active')

  if (error) {
    console.error('uptime-history: link load failed:', error)
    return NextResponse.json({ error: 'Failed to load monitor.' }, { status: 500 })
  }

  type LinkRow = {
    provider_resource_id: string | null
    integration: { key: string; input_values: Record<string, string> | null } | null
  }
  const row       = ((links ?? []) as unknown as LinkRow[]).find(r => r.integration?.key === 'betterstack') ?? null
  const monitorId = row?.provider_resource_id ?? null
  const apiKey    = (row?.integration?.input_values ?? {})['api_key'] ?? ''

  if (!monitorId || !apiKey) {
    return NextResponse.json({ error: 'Monitor not configured for this site.' }, { status: 404 })
  }

  const { buckets, rangeStart, rangeEnd } = planBuckets(range)

  let incidents: MonitorIncident[]
  try {
    incidents = await getMonitorIncidents(
      apiKey,
      monitorId,
      isoDate(rangeStart),
      // `to` is exclusive in the BS API, but we want incidents up to
      // and including the final bucket — pass the day AFTER rangeEnd.
      isoDate(new Date(rangeEnd.getTime() + 86_400_000)),
    )
  } catch (err) {
    console.error('uptime-history: incidents call failed:', err)
    return NextResponse.json({ error: 'Provider call failed.' }, { status: 502 })
  }

  const now = Date.now()

  for (const b of buckets) {
    const bStart = new Date(b.start).getTime()
    const bEnd   = bStart + b.durationMs

    let downtimeMs = 0
    let count      = 0
    for (const inc of incidents) {
      const incStart = new Date(inc.started_at).getTime()
      const incEnd   = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now
      const overlap  = Math.max(0, Math.min(bEnd, incEnd) - Math.max(bStart, incStart))
      if (overlap > 0) {
        downtimeMs += overlap
        count      += 1
      }
    }

    const bucketDuration = Math.min(b.durationMs, Math.max(0, now - bStart))
    const denominator    = Math.max(1, bucketDuration)
    const availability   = ((denominator - downtimeMs) / denominator) * 100

    b.bucket.availability     = clampPct(availability)
    b.bucket.downtime_seconds = downtimeMs / 1000
    b.bucket.incidents        = count
    b.bucket.has_data         = bStart <= now
  }

  // Overall = weighted across the actual elapsed window.
  const elapsedMs    = Math.max(1, Math.min(now, rangeEnd.getTime()) - rangeStart.getTime())
  const totalDownMs  = buckets.reduce((acc, b) => acc + b.bucket.downtime_seconds * 1000, 0)
  const overallAvail = clampPct(((elapsedMs - totalDownMs) / elapsedMs) * 100)
  const totalInc     = buckets.reduce((acc, b) => acc + b.bucket.incidents, 0)

  const payload: UptimeHistoryResponse = {
    range,
    buckets: buckets.map(b => b.bucket),
    overall: {
      availability:   overallAvail,
      total_downtime: totalDownMs / 1000,
      incidents:      totalInc,
    },
  }
  return NextResponse.json(payload)
}

/* ─────────────────────────── Bucket planning ───────────────────────────── */

interface PlannedBucket {
  bucket:     UptimeHistoryBucket
  start:      string  // duplicate of bucket.start for ergonomics
  durationMs: number
}

interface Plan {
  buckets:    PlannedBucket[]
  rangeStart: Date
  rangeEnd:   Date
}

function planBuckets(range: Range): Plan {
  const now = new Date()

  if (range === 'day') {
    // 24 hourly buckets ending at the top of the current hour.
    const end = new Date(now)
    end.setMinutes(0, 0, 0)
    end.setHours(end.getHours() + 1)
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)

    return {
      rangeStart: start,
      rangeEnd:   end,
      buckets: Array.from({ length: 24 }, (_, i) => {
        const bStart = new Date(start.getTime() + i * 60 * 60 * 1000)
        return {
          start:      bStart.toISOString(),
          durationMs: 60 * 60 * 1000,
          bucket: {
            label:            bStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            start:            bStart.toISOString(),
            availability:     100,
            downtime_seconds: 0,
            incidents:        0,
            has_data:         false,
          },
        }
      }),
    }
  }

  // week / month: UTC daily buckets so they align with provider date boundaries.
  const days = range === 'week' ? 7 : 30
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  // End = tomorrow UTC start, so the final bucket covers today-so-far.
  const end   = new Date(today.getTime() + 86_400_000)
  const start = new Date(end.getTime() - days * 86_400_000)

  return {
    rangeStart: start,
    rangeEnd:   end,
    buckets: Array.from({ length: days }, (_, i) => {
      const bStart = new Date(start.getTime() + i * 86_400_000)
      const showWeekday = days <= 7
      return {
        start:      bStart.toISOString(),
        durationMs: 86_400_000,
        bucket: {
          label: bStart.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short',
            ...(showWeekday ? { weekday: 'short' } : {}),
          }),
          start:            bStart.toISOString(),
          availability:     100,
          downtime_seconds: 0,
          incidents:        0,
          has_data:         false,
        },
      }
    }),
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0)   return 0
  if (n > 100) return 100
  return n
}
