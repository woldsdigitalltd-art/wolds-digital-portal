import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { AlertTriangle, CheckCircle, Bell, Info } from 'lucide-react'
import type { Incident, Alert, IncidentSeverity } from '@/lib/incidents/types'

interface SiteRow { id: string; display_name: string | null; domain: string }

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const sr = createServiceRoleClient()
  const { data: sites } = await sr.from('sites').select('id, display_name, domain').eq('owner_id', user.id)
  const siteList = (sites ?? []) as SiteRow[]
  const siteIds  = siteList.map(s => s.id)
  const siteMap  = new Map(siteList.map(s => [s.id, s]))

  const [{ data: openAlerts }, { data: openIncidents }] = await Promise.all([
    siteIds.length > 0
      ? sr.from('alerts').select('*').in('site_id', siteIds).eq('status', 'open').order('created_at', { ascending: false })
      : { data: [] },
    siteIds.length > 0
      ? sr.from('incidents').select('*').in('site_id', siteIds).eq('status', 'open').order('created_at', { ascending: false })
      : { data: [] },
  ])

  const alerts    = (openAlerts    ?? []) as Alert[]
  const incidents = (openIncidents ?? []) as Incident[]
  const hasItems  = alerts.length > 0 || incidents.length > 0

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Inbox
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
          Notifications<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600 md:text-base">
          Site alerts, billing updates and anything else we need to flag for you.
        </p>
      </div>

      {!hasItems && (
        <div className="rounded-2xl border border-white/60 bg-white/60 p-10 text-center shadow-soft backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Bell className="h-7 w-7" />
          </div>
          <p className="text-base font-semibold text-navy-900">You&apos;re all caught up</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-600">
            When something needs your attention — like a site going offline or an SEO issue — it&apos;ll show up here.
          </p>
        </div>
      )}

      {alerts.length > 0 && (
        <section className="mb-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-500">
            Active alerts
          </p>
          <ul className="flex flex-col gap-2">
            {alerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} site={siteMap.get(alert.site_id) ?? null} />
            ))}
          </ul>
        </section>
      )}

      {incidents.length > 0 && (
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-500">
            Open incidents
          </p>
          <ul className="flex flex-col gap-2">
            {incidents.map(incident => (
              <IncidentRow key={incident.id} incident={incident} site={siteMap.get(incident.site_id) ?? null} />
            ))}
          </ul>
          <div className="mt-4 text-right">
            <Link
              href="/portal/incidents"
              className="text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
            >
              View all incidents →
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

function severityStyle(severity: IncidentSeverity) {
  if (severity === 'critical') return { icon: AlertTriangle, bg: 'bg-red-50',   ring: 'ring-red-100',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700',   label: 'Critical' }
  if (severity === 'warning')  return { icon: AlertTriangle, bg: 'bg-amber-50', ring: 'ring-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: 'Warning'  }
  return                              { icon: Info,           bg: 'bg-brand-50', ring: 'ring-brand-100', text: 'text-brand-700', badge: 'bg-brand-100 text-brand-700', label: 'Info'     }
}

function AlertRow({ alert, site }: { alert: Alert; site: SiteRow | null }) {
  const s = severityStyle(alert.severity)
  const Icon = s.icon
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-white/60 bg-white/60 px-4 py-3.5 shadow-soft backdrop-blur-sm">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${s.bg} ${s.ring} ${s.text}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-navy-900">{alert.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.badge}`}>{s.label}</span>
        </div>
        {alert.description && <p className="mt-0.5 text-xs text-navy-500">{alert.description}</p>}
        {site && <p className="mt-1 text-xs text-navy-400">{site.display_name ?? site.domain}</p>}
      </div>
    </li>
  )
}

function IncidentRow({ incident, site }: { incident: Incident; site: SiteRow | null }) {
  const s = severityStyle(incident.severity)
  const Icon = s.icon
  return (
    <li>
      <Link
        href={`/portal/incidents/${incident.id}`}
        className="flex items-start gap-4 rounded-2xl border border-white/60 bg-white/60 px-4 py-3.5 shadow-soft backdrop-blur-sm transition hover:bg-white/80"
      >
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${s.bg} ${s.ring} ${s.text}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-navy-900">{incident.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.badge}`}>{s.label}</span>
            <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-600">
              Needs attention
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-navy-500">{incident.description}</p>
          {site && <p className="mt-1 text-xs text-navy-400">{site.display_name ?? site.domain}</p>}
        </div>
        <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-navy-300" />
      </Link>
    </li>
  )
}
