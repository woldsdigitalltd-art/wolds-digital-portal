import { Activity, CheckCircle, Clock, XCircle } from 'lucide-react'
import type { LiveUptime } from '@/lib/integrations/uptime'
import UptimeChart from './UptimeChart'

const STATUS_CONFIG = {
  up:      { Icon: CheckCircle, label: 'Online',  bg: 'bg-brand-50',  text: 'text-brand-700',  dot: 'bg-brand-500', border: 'border-brand-100' },
  down:    { Icon: XCircle,     label: 'Offline', bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',   border: 'border-red-100' },
  paused:  { Icon: Clock,       label: 'Paused',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500', border: 'border-amber-100' },
  unknown: { Icon: Activity,    label: 'Unknown', bg: 'bg-navy-50',   text: 'text-navy-700',   dot: 'bg-navy-400',  border: 'border-navy-100' },
} as const

export function MonitoringView({
  siteId, uptime,
}: {
  siteId: string
  uptime: LiveUptime | null
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
          Reliability
        </p>
        <p className="mt-1 text-sm text-navy-600">
          Live availability monitoring via Better Stack.
        </p>
      </div>

      <UptimeCard uptime={uptime} />
      <UptimeChart siteId={siteId} />
    </div>
  )
}

function UptimeCard({ uptime }: { uptime: LiveUptime | null }) {
  const status = (uptime?.status ?? 'unknown') as keyof typeof STATUS_CONFIG
  const cfg    = STATUS_CONFIG[status]
  const Icon   = cfg.Icon

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
      <div className="flex items-center gap-5">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${cfg.bg} ring-1 ${cfg.border}`}>
          <Icon className={`h-7 w-7 ${cfg.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            <span className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</span>
          </div>
          {uptime?.last_checked_at && (
            <p className="mt-0.5 text-xs text-navy-400">
              Last checked {new Date(uptime.last_checked_at).toLocaleString('en-GB')}
            </p>
          )}
        </div>
      </div>

      {uptime?.uptime_percentage !== null && uptime?.uptime_percentage !== undefined && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Uptime this month
          </p>
          <div className="mb-2 flex items-end gap-2">
            <span className="text-3xl font-bold text-navy-900">
              {uptime.uptime_percentage.toFixed(2)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-navy-50">
            <div
              className="h-2 rounded-full bg-brand-500 transition-all"
              style={{ width: `${uptime.uptime_percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
