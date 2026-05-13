'use client'

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  XCircle,
} from 'lucide-react'
import {
  categoryBreakdown,
  scoreColour,
  type SeoAuditResult,
} from '@/lib/integrations/seo-audit'
import {
  formatVital,
  lighthouseColour,
  SCORE_CATEGORIES,
  vitalColour,
  type PageSpeedResult,
} from '@/lib/integrations/page-speed'
import type { BrokenLinksResult } from '@/lib/integrations/broken-links'

/**
 * Compact panels for the per-site integration list in the admin
 * customer modal. Each panel renders the cached audit JSON the
 * provisioner stored on `site_integrations.provider_metadata`.
 *
 * These are intentionally low-density — the portal-facing pages at
 * /portal/websites/[id]/... are where customers see the full report.
 */

/* ─────────────────────────────── SEO Score ──────────────────────────────── */

export function SeoAuditPanel({ audit }: { audit: SeoAuditResult }) {
  const colour     = scoreColour(audit.score)
  const categories = categoryBreakdown(audit)
  const top        = audit.priorities?.slice(0, 5) ?? []

  return (
    <div className="mt-3 rounded-xl border border-navy-100 bg-navy-50/40 p-3">
      <div className="flex items-start gap-3">
        <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${colour.bg} ring-1 ${colour.ring}`}>
          <span className={`text-lg font-bold leading-none ${colour.text}`}>{audit.score}</span>
          <span className={`text-[9px] font-semibold uppercase tracking-wider ${colour.text}`}>
            {audit.grade}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-500">
            SEO score
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold text-navy-900">{audit.url}</p>
          <p className="mt-0.5 text-[10px] text-navy-400">
            Audited {fmtDate(audit.audited_at)}
          </p>
        </div>
      </div>

      {top.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
            Top priorities
          </p>
          <ul className="space-y-1.5">
            {top.map((p, i) => (
              <li key={i} className="rounded-lg border border-navy-100 bg-white px-2.5 py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold text-navy-900">{p.issue}</p>
                  <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                    {p.impact}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-navy-500">{p.fix}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
          Category breakdown
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {categories.map(({ key, label, counts }) => (
            <div
              key={key}
              className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
            >
              <p className="truncate text-[10px] font-semibold text-navy-700">{label}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-navy-500">
                {counts.total === 0 ? (
                  <span className="text-navy-400">—</span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-0.5 text-brand-700">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {counts.pass}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-amber-700">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {counts.warning}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-red-700">
                      <XCircle className="h-2.5 w-2.5" />
                      {counts.fail}
                    </span>
                    <span className="ml-auto text-navy-400">/{counts.total}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────── Page Speed ─────────────────────────── */

export function PageSpeedPanel({ report }: { report: PageSpeedResult }) {
  return (
    <div className="mt-3 rounded-xl border border-navy-100 bg-navy-50/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-500">
        Page Speed
      </p>
      <p className="mt-0.5 truncate text-xs font-semibold text-navy-900">{report.url}</p>
      <p className="mt-0.5 text-[10px] text-navy-400">
        Audited {fmtDate(report.audited_at)}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {SCORE_CATEGORIES.map(({ key, label }) => {
          const score  = report.scores[key]
          const colour = lighthouseColour(score)
          return (
            <div key={key} className="rounded-lg border border-navy-100 bg-white px-2 py-2 text-center">
              <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${colour.bg} ring-1 ${colour.ring}`}>
                <span className={`text-sm font-bold leading-none ${colour.text}`}>{score}</span>
              </div>
              <p className="mt-1.5 text-[10px] font-semibold text-navy-700">{label}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
          Core Web Vitals
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <VitalCell label="LCP" vital={report.core_web_vitals.lcp} />
          <VitalCell label="CLS" vital={report.core_web_vitals.cls} />
          <VitalCell label="TBT" vital={report.core_web_vitals.fid} />
        </div>
      </div>

      {report.opportunities.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
            Top opportunities
          </p>
          <ul className="space-y-1.5">
            {report.opportunities.slice(0, 5).map(op => (
              <li key={op.id} className="rounded-lg border border-navy-100 bg-white px-2.5 py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold text-navy-900">{op.title}</p>
                  {op.savings_ms !== undefined && op.savings_ms > 0 && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-100">
                      Save {Math.round(op.savings_ms)}ms
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function VitalCell({
  label, vital,
}: {
  label: string
  vital: PageSpeedResult['core_web_vitals']['lcp']
}) {
  const colour = vitalColour(vital.status)
  return (
    <div className="rounded-lg border border-navy-100 bg-white px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-navy-900">{formatVital(vital)}</p>
      <span className={`mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${colour.bg} ${colour.text} ring-1 ${colour.ring}`}>
        {colour.label}
      </span>
    </div>
  )
}

/* ─────────────────────────────── Broken Links ───────────────────────── */

export function BrokenLinksPanel({ report }: { report: BrokenLinksResult }) {
  const allClear = report.broken === 0

  return (
    <div className="mt-3 rounded-xl border border-navy-100 bg-navy-50/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-500">
        Broken Links
      </p>
      <p className="mt-0.5 truncate text-xs font-semibold text-navy-900">{report.url}</p>
      <p className="mt-0.5 text-[10px] text-navy-400">
        Audited {fmtDate(report.audited_at)}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Stat label="Scanned" value={report.total_links} tone="neutral" />
        <Stat
          label="Broken"
          value={report.broken}
          tone={report.broken > 0 ? 'bad' : 'good'}
        />
        <Stat
          label="Redirects"
          value={report.warnings}
          tone={report.warnings > 0 ? 'warn' : 'good'}
        />
      </div>

      {allClear ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
          <CheckCircle2 className="h-3 w-3" />
          No broken links found
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
            Broken (showing first {Math.min(report.broken_links.length, 10)})
          </p>
          <ul className="space-y-1">
            {report.broken_links.slice(0, 10).map((l, i) => (
              <li
                key={i}
                className="rounded-lg border border-red-100 bg-white px-2.5 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <a
                    href={l.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold text-navy-900 hover:text-brand-700"
                  >
                    <span className="truncate">{l.link}</span>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 text-navy-400" />
                  </a>
                  <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-700 ring-1 ring-red-200">
                    {l.status_code || 'ERR'}
                  </span>
                </div>
                {l.found_on && (
                  <p className="mt-0.5 truncate text-[10px] text-navy-400">
                    on {l.found_on}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({
  label, value, tone,
}: {
  label: string
  value: number
  tone:  'good' | 'warn' | 'bad' | 'neutral'
}) {
  const colour = {
    good:    { text: 'text-brand-700', bg: 'bg-brand-50',  ring: 'ring-brand-100' },
    warn:    { text: 'text-amber-700', bg: 'bg-amber-50',  ring: 'ring-amber-200' },
    bad:     { text: 'text-red-700',   bg: 'bg-red-50',    ring: 'ring-red-200'   },
    neutral: { text: 'text-navy-700',  bg: 'bg-white',     ring: 'ring-navy-100'  },
  }[tone]
  return (
    <div className={`rounded-lg border border-navy-100 px-2 py-1.5 text-center ${colour.bg} ring-1 ${colour.ring}`}>
      <p className={`text-base font-bold leading-none ${colour.text}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-navy-500">{label}</p>
    </div>
  )
}

/* ─────────────────────────────── Util ──────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
