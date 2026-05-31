import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Clock,
  SearchCheck,
  Unlink,
  XCircle,
} from 'lucide-react'
import type { LiveUptime } from '@/lib/integrations/uptime'
import { scoreColour, type SeoAuditResult } from '@/lib/integrations/seo-audit'
import type { BrokenLinksResult } from '@/lib/integrations/broken-links'

interface DashboardViewProps {
  basePath:       string
  hasSeo:         boolean
  hasMonitor:     boolean
  hasBrokenLinks: boolean
  uptime:         LiveUptime        | null
  audit:          SeoAuditResult    | null
  brokenLinks:    BrokenLinksResult | null
}

export function DashboardView({
  basePath,
  hasSeo, hasMonitor, hasBrokenLinks,
  uptime, audit, brokenLinks,
}: DashboardViewProps) {
  const anyIntegration = hasSeo || hasMonitor || hasBrokenLinks

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
          Overview
        </p>
        <p className="mt-1 text-sm text-navy-600">
          A snapshot of the integrations active for this site. Use the
          tabs above for the full report.
        </p>
      </div>

      {!anyIntegration ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {hasMonitor     && <MonitoringCard  basePath={basePath} uptime={uptime}      />}
          {hasSeo         && <SeoCard         basePath={basePath} audit={audit}        />}
          {hasBrokenLinks && <BrokenLinksCard basePath={basePath} report={brokenLinks} />}
        </div>
      )}
    </div>
  )
}

function MonitoringCard({
  basePath, uptime,
}: {
  basePath: string
  uptime:   LiveUptime | null
}) {
  const status = (uptime?.status ?? 'unknown') as 'up' | 'down' | 'paused' | 'unknown'
  const cfg = {
    up:      { Icon: CheckCircle, label: 'Online',  bg: 'bg-brand-50', text: 'text-brand-700', ring: 'ring-brand-100' },
    down:    { Icon: XCircle,     label: 'Offline', bg: 'bg-red-50',   text: 'text-red-700',   ring: 'ring-red-200'   },
    paused:  { Icon: Clock,       label: 'Paused',  bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
    unknown: { Icon: Activity,    label: 'Awaiting first check', bg: 'bg-navy-50', text: 'text-navy-700', ring: 'ring-navy-100' },
  }[status]
  const Icon = cfg.Icon

  return (
    <CardShell
      href={`${basePath}/monitoring`}
      eyebrow="Monitoring"
      title={cfg.label}
      titleClass={cfg.text}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cfg.bg} ring-1 ${cfg.ring}`}>
        <Icon className={`h-6 w-6 ${cfg.text}`} />
      </div>
      <div className="min-w-0 flex-1">
        {uptime?.uptime_percentage !== null && uptime?.uptime_percentage !== undefined ? (
          <p className="text-xs text-navy-600">
            <strong className="text-navy-900">{uptime.uptime_percentage.toFixed(2)}%</strong>{' '}
            uptime this month
          </p>
        ) : (
          <p className="text-xs text-navy-500">
            Live availability check via Better Stack.
          </p>
        )}
        {uptime?.last_checked_at && (
          <p className="mt-0.5 text-[11px] text-navy-400">
            Last checked {new Date(uptime.last_checked_at).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </CardShell>
  )
}

function SeoCard({
  basePath, audit,
}: {
  basePath: string
  audit:    SeoAuditResult | null
}) {
  if (!audit) {
    return (
      <CardShell
        href={`${basePath}/seo`}
        eyebrow="SEO"
        title="Audit pending"
        titleClass="text-navy-700"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500 ring-1 ring-navy-100">
          <SearchCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-navy-500">
            We&apos;re preparing your first audit. Check back shortly.
          </p>
        </div>
      </CardShell>
    )
  }

  const colour = scoreColour(audit.score)
  return (
    <CardShell
      href={`${basePath}/seo`}
      eyebrow="SEO"
      title={`Grade ${audit.grade}`}
      titleClass={colour.text}
    >
      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${colour.bg} ring-1 ${colour.ring}`}>
        <span className={`text-base font-bold leading-none ${colour.text}`}>{audit.score.toFixed(1)}</span>
        <span className={`mt-0.5 text-[9px] font-semibold uppercase tracking-wider ${colour.text}`}>
          /100
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-navy-600">
          {audit.priorities?.length
            ? `${audit.priorities.length} priorit${audit.priorities.length === 1 ? 'y' : 'ies'} to address`
            : 'Looking healthy — no top priorities flagged.'}
        </p>
        <p className="mt-0.5 text-[11px] text-navy-400">
          Audited {new Date(audit.audited_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </CardShell>
  )
}

function BrokenLinksCard({
  basePath, report,
}: {
  basePath: string
  report:   BrokenLinksResult | null
}) {
  if (!report) {
    return (
      <CardShell
        href={`${basePath}/broken-links`}
        eyebrow="Broken Links"
        title="Scan pending"
        titleClass="text-navy-700"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500 ring-1 ring-navy-100">
          <Unlink className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-navy-500">
            We&apos;re preparing your first link scan.
          </p>
        </div>
      </CardShell>
    )
  }

  const broken = report.broken
  const cfg = broken === 0
    ? { Icon: CheckCircle2, bg: 'bg-brand-50', text: 'text-brand-700', ring: 'ring-brand-100', title: 'All links working' }
    : { Icon: Unlink,       bg: 'bg-red-50',   text: 'text-red-700',   ring: 'ring-red-200',   title: `${broken} broken link${broken === 1 ? '' : 's'}` }
  const Icon = cfg.Icon

  return (
    <CardShell
      href={`${basePath}/broken-links`}
      eyebrow="Broken Links"
      title={cfg.title}
      titleClass={cfg.text}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cfg.bg} ring-1 ${cfg.ring}`}>
        <Icon className={`h-6 w-6 ${cfg.text}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-navy-600">
          {report.total_links.toLocaleString('en-GB')} link{report.total_links === 1 ? '' : 's'} scanned
          {report.warnings > 0 && ` · ${report.warnings} redirect${report.warnings === 1 ? '' : 's'}`}
        </p>
        <p className="mt-0.5 text-[11px] text-navy-400">
          Audited {new Date(report.audited_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </CardShell>
  )
}

function CardShell({
  href, eyebrow, title, titleClass = 'text-navy-900', children,
}: {
  href:        string
  eyebrow:    string
  title:       string
  titleClass?: string
  children:    React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          {eyebrow}
        </p>
        <ArrowRight className="h-4 w-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </div>
      <div className="flex items-start gap-4">
        {children}
      </div>
      <p className={`text-lg font-bold ${titleClass}`}>{title}</p>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center backdrop-blur-sm">
      <p className="text-sm font-semibold text-navy-900">No integrations active yet</p>
      <p className="mt-1 text-sm text-navy-600">
        Once we&apos;ve enabled SEO audits, link scans, or uptime monitoring
        for this site, you&apos;ll see them here.{' '}
        <a
          href="mailto:hello@woldsdigital.co.uk?subject=Enable%20integrations"
          className="font-semibold text-brand-700 underline-offset-2 hover:underline"
        >
          Contact us
        </a>{' '}
        to get started.
      </p>
    </div>
  )
}
