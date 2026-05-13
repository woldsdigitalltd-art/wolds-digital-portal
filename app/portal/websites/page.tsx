import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchUptimeBySite, type LiveUptime } from '@/lib/integrations/uptime'
import {
  Activity,
  ArrowRight,
  CheckCircle,
  Clock,
  ExternalLink,
  Globe,
  XCircle,
} from 'lucide-react'

interface WebsiteIntegration {
  id:   string
  key:  string
  name: string
}

interface Website {
  id:           string
  domain:       string
  display_name: string | null
  integrations: WebsiteIntegration[]
}

export default async function WebsitesPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_my_websites')
  if (error) console.error('get_my_websites failed:', error)
  const sites = ((data ?? []) as Website[])

  // Live uptime for any site with Better Stack attached. We fetch from
  // the provider so the customer always sees the truth.
  const uptimeMap = await fetchUptimeBySite(sites.map(s => s.id))

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Your web presence
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
          Websites<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600 md:text-base">
          Every site we&apos;re looking after for you, with the integrations we&apos;ve enabled
          and the latest availability check at a glance.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 backdrop-blur-sm">
          We couldn&apos;t load your websites: {error.message}
        </div>
      )}

      {sites.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-white/60 overflow-hidden rounded-2xl border border-white/60 bg-white/55 shadow-soft backdrop-blur-md">
          {sites.map(site => (
            <WebsiteRow
              key={site.id}
              site={site}
              uptime={uptimeMap.get(site.id) ?? null}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function WebsiteRow({
  site, uptime,
}: {
  site:   Website
  uptime: LiveUptime | null
}) {
  const integrations = site.integrations ?? []
  const monitored    = integrations.some(i => i.key === 'betterstack')
  const status       = uptime?.status ?? (monitored ? 'unknown' : null)
  const display      = site.display_name?.trim() || site.domain

  return (
    <li className="flex flex-col gap-4 px-5 py-4 transition hover:bg-white/40 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="flex min-w-0 items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-navy-900">{display}</p>
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700 transition hover:text-brand-800"
          >
            {site.domain}
            <ExternalLink className="h-3 w-3" />
          </a>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {integrations.length === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-navy-200 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-navy-500">
                No integrations enabled
              </span>
            ) : (
              integrations.map(i => (
                <IntegrationBadge key={i.id} label={i.name} />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 md:items-end">
        <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end md:gap-1.5">
          <StatusPill status={status} />
          {monitored && (
            <p className="text-[11px] text-navy-500">
              {uptime?.uptime_percentage !== null && uptime?.uptime_percentage !== undefined
                ? <><strong className="text-navy-700">{uptime.uptime_percentage.toFixed(2)}%</strong> uptime</>
                : 'Awaiting first check'}
              {uptime?.last_checked_at && (
                <span className="ml-1 text-navy-400">
                  · {formatRelative(uptime.last_checked_at)}
                </span>
              )}
            </p>
          )}
        </div>
        <Link
          href={`/portal/websites/${site.id}`}
          className="group/manage inline-flex items-center justify-center gap-1.5 rounded-full bg-navy-900 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(11,37,69,0.35)] transition hover:bg-navy-800"
        >
          Manage
          <ArrowRight className="h-3 w-3 transition group-hover/manage:translate-x-0.5" />
        </Link>
      </div>
    </li>
  )
}

function IntegrationBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50/80 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
      <Activity className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

function StatusPill({
  status,
}: {
  status: 'up' | 'down' | 'paused' | 'unknown' | null
}) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-navy-500">
        <Clock className="h-3 w-3" />
        Not monitored
      </span>
    )
  }

  const cfg = {
    up:      { Icon: CheckCircle, label: 'Online',  border: 'border-brand-100', bg: 'bg-brand-50/80', text: 'text-brand-700', dot: 'bg-brand-500' },
    down:    { Icon: XCircle,     label: 'Offline', border: 'border-red-100',   bg: 'bg-red-50/80',   text: 'text-red-700',   dot: 'bg-red-500' },
    paused:  { Icon: Clock,       label: 'Paused',  border: 'border-amber-100', bg: 'bg-amber-50/80', text: 'text-amber-700', dot: 'bg-amber-500' },
    unknown: { Icon: Activity,    label: 'Status unknown', border: 'border-navy-100', bg: 'bg-white/80', text: 'text-navy-600', dot: 'bg-navy-300' },
  }[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${cfg.border} ${cfg.bg} px-2.5 py-1 text-[11px] font-semibold ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center backdrop-blur-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
        <Globe className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-navy-900">No websites yet</p>
      <p className="mt-1 text-sm text-navy-600">
        Your site details haven&apos;t been set up. Drop us a line at{' '}
        <a
          href="mailto:hello@woldsdigital.com"
          className="font-semibold text-brand-700 underline-offset-2 hover:underline"
        >
          hello@woldsdigital.com
        </a>{' '}
        and we&apos;ll get you online.
      </p>
    </div>
  )
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  const diffHr  = Math.round(diffMs / 3_600_000)
  const diffDay = Math.round(diffMs / 86_400_000)

  if (diffMin < 1)        return 'just now'
  if (diffMin < 60)       return `${diffMin}m ago`
  if (diffHr  < 24)       return `${diffHr}h ago`
  if (diffDay < 30)       return `${diffDay}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
