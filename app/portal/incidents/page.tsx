import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import type { Incident, IncidentSeverity, IncidentStatus } from '@/lib/incidents/types'

interface SiteRow { id: string; display_name: string | null; domain: string }

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const { status: statusFilter } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const sr = createServiceRoleClient()
  const { data: sites } = await sr.from('sites').select('id, display_name, domain').eq('owner_id', user.id)
  const siteList = (sites ?? []) as SiteRow[]
  const siteIds  = siteList.map(s => s.id)
  const siteMap  = new Map(siteList.map(s => [s.id, s]))

  let query = sr.from('incidents').select('*').order('created_at', { ascending: false })
  if (siteIds.length > 0) {
    query = query.in('site_id', siteIds)
  } else {
    return <EmptyState />
  }

  const validStatus = ['open', 'resolved', 'dismissed'] as const
  const activeFilter = validStatus.find(s => s === statusFilter) ?? null
  if (activeFilter) query = query.eq('status', activeFilter)

  const { data } = await query
  const incidents = (data ?? []) as Incident[]

  const FILTERS: Array<{ label: string; value: string | null }> = [
    { label: 'All',       value: null         },
    { label: 'Open',      value: 'open'       },
    { label: 'Resolved',  value: 'resolved'   },
    { label: 'Dismissed', value: 'dismissed'  },
  ]

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Issues & findings
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
          Incidents<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600 md:text-base">
          Issues flagged by your site monitoring integrations.
        </p>
      </div>

      <div className="mb-5 flex gap-2">
        {FILTERS.map(f => {
          const href = f.value ? `/portal/incidents?status=${f.value}` : '/portal/incidents'
          const active = f.value === activeFilter || (f.value === null && activeFilter === null)
          return (
            <Link
              key={f.label}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-navy-900 text-white'
                  : 'bg-white/60 text-navy-600 ring-1 ring-white/60 hover:bg-white/80'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {incidents.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-white/60 p-10 text-center shadow-soft backdrop-blur-sm">
          <p className="text-sm font-semibold text-navy-900">No incidents found</p>
          <p className="mt-1 text-xs text-navy-500">
            {activeFilter ? `No ${activeFilter} incidents to show.` : 'No incidents have been raised yet.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/60 overflow-hidden rounded-2xl border border-white/60 bg-white/55 shadow-soft backdrop-blur-md">
          {incidents.map(incident => (
            <IncidentRow key={incident.id} incident={incident} site={siteMap.get(incident.site_id) ?? null} />
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
          Incidents<span className="text-brand-500">.</span>
        </h1>
      </div>
      <div className="rounded-2xl border border-white/60 bg-white/60 p-10 text-center shadow-soft backdrop-blur-sm">
        <p className="text-sm text-navy-500">No sites found.</p>
      </div>
    </div>
  )
}

function severityStyle(severity: IncidentSeverity) {
  if (severity === 'critical') return { icon: AlertTriangle, bg: 'bg-red-50',   ring: 'ring-red-100',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700',   label: 'Critical' }
  if (severity === 'warning')  return { icon: AlertTriangle, bg: 'bg-amber-50', ring: 'ring-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: 'Warning'  }
  return                              { icon: Info,           bg: 'bg-brand-50', ring: 'ring-brand-100', text: 'text-brand-700', badge: 'bg-brand-100 text-brand-700', label: 'Info'     }
}

function statusStyle(status: IncidentStatus) {
  if (status === 'resolved')  return { icon: CheckCircle, text: 'text-brand-700', badge: 'bg-brand-100 text-brand-700',  label: 'Resolved'  }
  if (status === 'dismissed') return { icon: XCircle,     text: 'text-navy-500',  badge: 'bg-navy-100 text-navy-600',    label: 'Dismissed' }
  return                             { icon: AlertTriangle, text: 'text-navy-700', badge: 'bg-navy-100 text-navy-700',   label: 'Open'      }
}

function IncidentRow({ incident, site }: { incident: Incident; site: SiteRow | null }) {
  const sev = severityStyle(incident.severity)
  const sts = statusStyle(incident.status)
  const SevIcon = sev.icon
  const date = new Date(incident.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <li>
      <Link
        href={`/portal/incidents/${incident.id}`}
        className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/40"
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${sev.bg} ${sev.ring} ${sev.text}`}>
          <SevIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-navy-900">{incident.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sev.badge}`}>{sev.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sts.badge}`}>{sts.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-navy-400">
            {site ? `${site.display_name ?? site.domain} · ` : ''}{date}
          </p>
        </div>
        <span className="text-xs text-navy-300">→</span>
      </Link>
    </li>
  )
}
