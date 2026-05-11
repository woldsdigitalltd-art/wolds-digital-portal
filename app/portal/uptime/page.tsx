import { createClient } from '@/lib/supabase/server'
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react'

export default async function UptimePage() {
  const supabase = await createClient()
  const { data: portalData } = await supabase.rpc('get_my_portal_data')
  const site   = portalData?.sites?.[0]?.site
  const uptime = portalData?.sites?.[0]?.uptime

  const statusConfig = {
    up:      { icon: CheckCircle, label: 'Online',  bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
    down:    { icon: XCircle,     label: 'Offline', bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500'    },
    paused:  { icon: Clock,       label: 'Paused',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
    unknown: { icon: Activity,    label: 'Unknown', bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400'  },
  }

  const status = (uptime?.status ?? 'unknown') as keyof typeof statusConfig
  const cfg    = statusConfig[status]
  const Icon   = cfg.icon

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Uptime</h1>
        <p className="text-slate-500 text-sm mt-1">
          Live availability monitoring for {site?.domain ?? 'your website'}.
        </p>
      </div>

      {uptime ? (
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center gap-5">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${cfg.bg}`}>
              <Icon className={`w-7 h-7 ${cfg.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-lg font-semibold ${cfg.text}`}>{cfg.label}</span>
              </div>
              <p className="text-slate-500 text-sm">{site?.domain}</p>
              {uptime.last_checked_at && (
                <p className="text-slate-400 text-xs mt-0.5">
                  Last checked {new Date(uptime.last_checked_at).toLocaleString('en-GB')}
                </p>
              )}
            </div>
          </div>

          {/* Uptime percentage */}
          {uptime.uptime_percentage !== null && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">
                Uptime this month
              </p>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-bold text-slate-900">
                  {Number(uptime.uptime_percentage).toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${uptime.uptime_percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <Activity className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            Uptime monitoring hasn&apos;t been configured yet.{' '}
            <a href="mailto:hello@woldsdigital.com" className="text-brand-600 hover:underline">
              Contact us
            </a>{' '}
            to get this set up.
          </p>
        </div>
      )}
    </div>
  )
}
