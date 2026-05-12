import { createClient } from '@/lib/supabase/server'
import {
  Activity,
  BarChart3,
  CheckCircle,
  Clock,
  ExternalLink,
  Globe,
  XCircle,
} from 'lucide-react'

interface Website {
  id:                       string
  domain:                   string
  display_name:             string | null
  analytics_enabled:        boolean
  uptime_enabled:           boolean
  uptime_status?:           string | null
  uptime_percentage?:       number | string | null
  uptime_last_checked_at?:  string | null
}

export default async function WebsitesPage() {
  const supabase = await createClient()

  // Prefer the new dedicated RPC. It returns service flags + the most
  // recent uptime sample joined in. If the migration that adds it
  // hasn't run yet, fall back to an empty list so the page still
  // renders rather than 500-ing.
  const { data, error } = await supabase.rpc('get_my_websites')
  if (error) {
    console.error('get_my_websites failed:', error)
  }
  const sites = ((data ?? []) as Website[])

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
          Every site we&apos;re looking after for you, with the services we&apos;ve enabled
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
            <WebsiteRow key={site.id} site={site} />
          ))}
        </ul>
      )}
    </div>
  )
}

function WebsiteRow({ site }: { site: Website }) {
  const status = (site.uptime_status ?? (site.uptime_enabled ? 'unknown' : null)) as
    | 'up'
    | 'down'
    | 'paused'
    | 'unknown'
    | null

  const pct =
    typeof site.uptime_percentage === 'string'
      ? Number.parseFloat(site.uptime_percentage)
      : site.uptime_percentage ?? null

  const display = site.display_name?.trim() || site.domain

  return (
    <li className="flex flex-col gap-4 px-5 py-4 transition hover:bg-white/40 md:flex-row md:items-center md:justify-between md:gap-6">
      {/* Left: identity + meta */}
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

          {/* Active services */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {!site.analytics_enabled && !site.uptime_enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-navy-200 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-navy-500">
                No services enabled
              </span>
            ) : (
              <>
                {site.analytics_enabled && (
                  <ServiceBadge icon={BarChart3} label="Analytics" />
                )}
                {site.uptime_enabled && (
                  <ServiceBadge icon={Activity} label="Uptime" />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: status + uptime stat */}
      <div className="flex shrink-0 items-center gap-3 md:flex-col md:items-end md:gap-1.5">
        <StatusPill status={status} />
        {site.uptime_enabled && (
          <p className="text-[11px] text-navy-500">
            {pct !== null && !Number.isNaN(pct)
              ? <><strong className="text-navy-700">{pct.toFixed(2)}%</strong> uptime</>
              : 'Awaiting first check'}
            {site.uptime_last_checked_at && (
              <span className="ml-1 text-navy-400">
                · {formatRelative(site.uptime_last_checked_at)}
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  )
}

function ServiceBadge({
  icon: Icon,
  label,
}: {
  icon: React.ElementType
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50/80 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
      <Icon className="h-2.5 w-2.5" />
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
