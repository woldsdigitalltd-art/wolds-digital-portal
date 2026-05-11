import { createClient } from '@/lib/supabase/server'
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react'

export default async function UptimePage() {
  const supabase = await createClient()
  const { data: portalData } = await supabase.rpc('get_my_portal_data')
  const site   = portalData?.sites?.[0]?.site
  const uptime = portalData?.sites?.[0]?.uptime

  const statusConfig = {
    up:      { icon: CheckCircle, label: 'Online',  bg: 'bg-brand-50',  text: 'text-brand-700',  dot: 'bg-brand-500', border: 'border-brand-100' },
    down:    { icon: XCircle,     label: 'Offline', bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',   border: 'border-red-100' },
    paused:  { icon: Clock,       label: 'Paused',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500', border: 'border-amber-100' },
    unknown: { icon: Activity,    label: 'Unknown', bg: 'bg-navy-50',   text: 'text-navy-700',   dot: 'bg-navy-400',  border: 'border-navy-100' },
  } as const

  const status = (uptime?.status ?? 'unknown') as keyof typeof statusConfig
  const cfg    = statusConfig[status]
  const Icon   = cfg.icon

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">
          Reliability
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          Uptime<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Live availability monitoring for {site?.domain ?? 'your website'}.
        </p>
      </div>

      {uptime ? (
        <div className="space-y-4">
          {/* Status card */}
          <div className="flex items-center gap-5 rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${cfg.bg} ring-1 ${cfg.border}`}>
              <Icon className={`h-7 w-7 ${cfg.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <span className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</span>
              </div>
              <p className="text-sm text-navy-600 mt-0.5">{site?.domain}</p>
              {uptime.last_checked_at && (
                <p className="mt-0.5 text-xs text-navy-400">
                  Last checked {new Date(uptime.last_checked_at).toLocaleString('en-GB')}
                </p>
              )}
            </div>
          </div>

          {/* Uptime percentage */}
          {uptime.uptime_percentage !== null && (
            <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400 mb-3">
                Uptime this month
              </p>
              <div className="mb-3 flex items-end gap-2">
                <span className="text-4xl font-bold text-navy-900">
                  {Number(uptime.uptime_percentage).toFixed(2)}%
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
      ) : (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
          <Activity className="mx-auto mb-3 h-8 w-8 text-navy-300" />
          <p className="text-sm text-navy-600">
            Uptime monitoring hasn&apos;t been configured yet.{' '}
            <a
              href="mailto:hello@woldsdigital.co.uk"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Contact us
            </a>{' '}
            to get this set up.
          </p>
        </div>
      )}
    </div>
  )
}
