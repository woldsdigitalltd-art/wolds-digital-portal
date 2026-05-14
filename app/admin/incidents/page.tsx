import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import type { Incident, IncidentSeverity, IncidentStatus } from '@/lib/incidents/types'

interface SiteRow { id: string; display_name: string | null; domain: string }

export const metadata = { title: 'Incidents — Admin' }

export default async function AdminIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: isAdminFlag } = await supabase.rpc('is_current_user_admin')
  if (!isAdminFlag) redirect('/portal')

  const { status: statusFilter, integration: integrationFilter } = await searchParams

  const sr = createServiceRoleClient()
  const { data: sitesRaw } = await sr.from('sites').select('id, display_name, domain')
  const siteMap = new Map(((sitesRaw ?? []) as SiteRow[]).map(s => [s.id, s]))

  let query = sr.from('incidents').select('*').order('created_at', { ascending: false })

  const validStatus = ['open', 'resolved', 'dismissed'] as const
  const activeStatus = validStatus.find(s => s === statusFilter) ?? null
  if (activeStatus) query = query.eq('status', activeStatus)
  if (integrationFilter) query = query.eq('integration_key', integrationFilter)

  const { data } = await query
  const incidents = (data ?? []) as Incident[]

  const openCount     = incidents.filter(i => i.status === 'open').length
  const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status === 'open').length

  const STATUS_FILTERS = [
    { label: 'All',       value: null         },
    { label: 'Open',      value: 'open'       },
    { label: 'Resolved',  value: 'resolved'   },
    { label: 'Dismissed', value: 'dismissed'  },
  ]

  const INTEGRATION_FILTERS = [
    { label: 'All integrations', value: null            },
    { label: 'SEO',              value: 'seo'           },
    { label: 'Broken Links',     value: 'broken-links'  },
    { label: 'Page Speed',       value: 'page-speed'    },
    { label: 'Uptime',           value: 'uptime'        },
  ]

  function filterHref(newStatus: string | null, newIntegration: string | null) {
    const p = new URLSearchParams()
    if (newStatus)      p.set('status',      newStatus)
    if (newIntegration) p.set('integration', newIntegration)
    const qs = p.toString()
    return `/admin/incidents${qs ? `?${qs}` : ''}`
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
          Monitoring
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
          Incidents<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-500">
          Issues flagged by integration rules across all customer sites.
        </p>
      </div>

      {/* Summary counts */}
      {(openCount > 0 || criticalCount > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {openCount > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">{openCount} open incident{openCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-semibold text-red-800">{criticalCount} critical</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS_FILTERS.map(f => {
          const active = f.value === activeStatus || (f.value === null && !activeStatus)
          return (
            <Link
              key={f.label}
              href={filterHref(f.value, integrationFilter ?? null)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-200 hover:bg-navy-50'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {INTEGRATION_FILTERS.map(f => {
          const active = f.value === (integrationFilter ?? null)
          return (
            <Link
              key={f.label}
              href={filterHref(activeStatus, f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active ? 'bg-brand-600 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-200 hover:bg-navy-50'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {incidents.length === 0 ? (
        <div className="rounded-2xl border border-navy-100 bg-white p-10 text-center">
          <p className="text-sm text-navy-500">No incidents found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">Incident</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">Site</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">Integration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-500">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {incidents.map(incident => (
                <IncidentTableRow
                  key={incident.id}
                  incident={incident}
                  site={siteMap.get(incident.site_id) ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function severityStyle(severity: IncidentSeverity) {
  if (severity === 'critical') return { badge: 'bg-red-100 text-red-700', label: 'Critical' }
  if (severity === 'warning')  return { badge: 'bg-amber-100 text-amber-700', label: 'Warning' }
  return                              { badge: 'bg-brand-100 text-brand-700', label: 'Info' }
}

function statusStyle(status: IncidentStatus) {
  if (status === 'resolved')  return { icon: CheckCircle, badge: 'bg-brand-100 text-brand-700',  label: 'Resolved'  }
  if (status === 'dismissed') return { icon: XCircle,     badge: 'bg-navy-100 text-navy-600',    label: 'Dismissed' }
  return                             { icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700', label: 'Open'      }
}

function IncidentTableRow({ incident, site }: { incident: Incident; site: SiteRow | null }) {
  const sev = severityStyle(incident.severity)
  const sts = statusStyle(incident.status)
  const date = new Date(incident.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <tr className="transition hover:bg-navy-50/50">
      <td className="px-4 py-3">
        <Link href={`/admin/incidents/${incident.id}`} className="font-medium text-navy-900 hover:text-brand-700 hover:underline">
          {incident.title}
        </Link>
      </td>
      <td className="px-4 py-3 text-navy-600">{site ? (site.display_name ?? site.domain) : '—'}</td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-600">
          {incident.integration_key}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sev.badge}`}>
          {sev.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sts.badge}`}>
          {sts.label}
        </span>
      </td>
      <td className="px-4 py-3 text-navy-500">{date}</td>
    </tr>
  )
}
