'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import type {
  UptimeHistoryBucket,
  UptimeHistoryResponse,
} from '@/lib/integrations/uptime-history'

type Range = 'day' | 'week' | 'month'

const RANGE_LABELS: Record<Range, string> = {
  day:   'Day',
  week:  'Week',
  month: 'Month',
}

interface Props {
  siteId: string
}

export default function UptimeChart({ siteId }: Props) {
  const [range,   setRange]   = useState<Range>('week')
  const [data,    setData]    = useState<UptimeHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let aborted = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/portal/uptime-history?siteId=${siteId}&range=${range}`)
        const json = await res.json().catch(() => ({})) as UptimeHistoryResponse & { error?: string }
        if (aborted) return
        if (!res.ok) {
          setError(json.error ?? 'Could not load uptime history.')
          setData(null)
          return
        }
        setData(json)
      } catch {
        if (!aborted) setError('Network error. Please try again.')
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [siteId, range])

  return (
    <div className="mt-6 rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Uptime over time
          </p>
          {data && (
            <p className="mt-1 text-sm text-navy-600">
              <span className="font-semibold text-navy-900">
                {data.overall.availability.toFixed(2)}%
              </span>
              {' '}availability
              {data.overall.total_downtime > 0 && (
                <> · {formatDowntime(data.overall.total_downtime)} downtime</>
              )}
            </p>
          )}
        </div>

        <div className="inline-flex rounded-full border border-navy-100 bg-navy-50/60 p-0.5 text-xs font-semibold">
          {(['day', 'week', 'month'] as Range[]).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`
                rounded-full px-3 py-1 transition
                ${range === r
                  ? 'bg-navy-900 text-white shadow-soft'
                  : 'text-navy-600 hover:text-navy-900'}
              `}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-[140px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-navy-400" />
          </div>
        )}

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        ) : data ? (
          <BarChart buckets={data.buckets} />
        ) : (
          !loading && (
            <p className="text-sm text-navy-500">No data yet.</p>
          )
        )}
      </div>
    </div>
  )
}

function BarChart({ buckets }: { buckets: UptimeHistoryBucket[] }) {
  // Show a sparse label set so the x-axis doesn't get crowded.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8))

  return (
    <div className="flex flex-col">
      <div className="flex h-32 items-end gap-1">
        {buckets.map((b, i) => (
          <BarBucket key={`${b.start}-${i}`} bucket={b} />
        ))}
      </div>
      <div className="mt-2 flex gap-1 text-[10px] font-medium text-navy-400">
        {buckets.map((b, i) => (
          <div
            key={`${b.start}-l-${i}`}
            className="flex-1 truncate text-center"
          >
            {i % labelEvery === 0 ? b.label : ''}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end gap-4 text-[10px] font-medium text-navy-500">
        <LegendDot className="bg-brand-500" label="≥ 99.9%" />
        <LegendDot className="bg-amber-400" label="99–99.9%" />
        <LegendDot className="bg-red-500"   label="< 99%" />
        <LegendDot className="bg-navy-200"  label="No data" />
      </div>
    </div>
  )
}

function BarBucket({ bucket }: { bucket: UptimeHistoryBucket }) {
  const { availability, has_data, label } = bucket
  // Bar height: invert availability so that ~100% fills the bar.
  // Always show at least a small sliver for visual continuity.
  const heightPct = has_data ? Math.max(8, availability) : 100

  const tone = !has_data
    ? 'bg-navy-200'
    : availability >= 99.9
      ? 'bg-brand-500'
      : availability >= 99
        ? 'bg-amber-400'
        : 'bg-red-500'

  const tooltip = has_data
    ? `${label}: ${availability.toFixed(2)}%${
        bucket.downtime_seconds > 0 ? ` · ${formatDowntime(bucket.downtime_seconds)} down` : ''
      }`
    : `${label}: no data`

  return (
    <div
      title={tooltip}
      className="group relative flex flex-1 items-end"
      style={{ minWidth: 4 }}
    >
      <div
        className={`w-full rounded-sm transition group-hover:opacity-80 ${tone}`}
        style={{ height: `${heightPct}%` }}
      />
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  )
}

function formatDowntime(seconds: number): string {
  if (seconds < 60)    return `${Math.round(seconds)}s`
  if (seconds < 3600)  return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}
