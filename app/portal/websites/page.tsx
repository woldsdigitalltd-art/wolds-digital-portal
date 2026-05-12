import { createClient } from '@/lib/supabase/server'
import { Globe, ExternalLink, Activity, Clock, CheckCircle, XCircle } from 'lucide-react'

interface SiteEntry {
  site: {
    id:           string
    domain:       string
    display_name: string | null
  } | null
  uptime?: {
    status?:             string | null
    uptime_percentage?:  number | string | null
    last_checked_at?:    string | null
  } | null
}

export default async function WebsitesPage() {
  const supabase = await createClient()
  const { data: portalData } = await supabase.rpc('get_my_portal_data')

  const sites: SiteEntry[] = portalData?.sites ?? []

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
          Every site we&apos;re looking after for you, with live availability at a glance.
        </p>
      </div>

      {sites.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sites.map((entry, i) =>
            entry.site ? <SiteCard key={entry.site.id ?? i} entry={entry} /> : null
          )}
        </div>
      )}
    </div>
  )
}

function SiteCard({ entry }: { entry: SiteEntry }) {
  if (!entry.site) return null
  const { site, uptime } = entry
  const status = (uptime?.status ?? 'unknown') as 'up' | 'down' | 'paused' | 'unknown'

  const cfg = {
    up:      { Icon: CheckCircle, label: 'Online',         dot: 'bg-brand-500',  text: 'text-brand-700',  bg: 'bg-brand-50/80',  border: 'border-brand-100' },
    down:    { Icon: XCircle,     label: 'Offline',        dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50/80',    border: 'border-red-100' },
    paused:  { Icon: Clock,       label: 'Paused',         dot: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50/80',  border: 'border-amber-100' },
    unknown: { Icon: Activity,    label: 'Status unknown', dot: 'bg-navy-300',   text: 'text-navy-600',   bg: 'bg-white/80',     border: 'border-navy-100' },
  }[status]

  const pct = uptime?.uptime_percentage
  const pctNumber = typeof pct === 'string' ? Number.parseFloat(pct) : pct ?? null

  return (
    <div className="group rounded-2xl border border-white/60 bg-white/60 p-5 shadow-soft backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-navy-900">
              {site.display_name ?? site.domain}
            </p>
            <a
              href={`https://${site.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700 transition hover:text-brand-800"
            >
              {site.domain}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border ${cfg.border} ${cfg.bg} px-2.5 py-1 text-[11px] font-semibold ${cfg.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/60 pt-4">
        <Stat
          label="Uptime"
          value={pctNumber !== null && !Number.isNaN(pctNumber) ? `${pctNumber.toFixed(2)}%` : '—'}
        />
        <Stat
          label="Last check"
          value={
            uptime?.last_checked_at
              ? formatRelative(uptime.last_checked_at)
              : '—'
          }
        />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-navy-900">{value}</p>
    </div>
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
