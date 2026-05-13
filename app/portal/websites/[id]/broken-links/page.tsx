import { notFound } from 'next/navigation'
import { CheckCircle2, ExternalLink, Unlink } from 'lucide-react'
import { fetchBrokenLinksBySite } from '@/lib/integrations/audits'
import type { BrokenLinksResult } from '@/lib/integrations/broken-links'
import { hasIntegration, loadOwnedSite } from '../site-loader'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WebsiteBrokenLinksPage({ params }: PageProps) {
  const { id } = await params
  const site   = await loadOwnedSite(id)
  if (!site)                              notFound()
  if (!hasIntegration(site, 'brokenlinks')) notFound()

  const map    = await fetchBrokenLinksBySite([site.id])
  const report = map.get(site.id) ?? null

  return (
    <div>
      <SectionHeader />

      {!report ? <PendingState /> : <BrokenLinksReport report={report} />}
    </div>
  )
}

function SectionHeader() {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
        Link health
      </p>
      <p className="mt-1 text-sm text-navy-600">
        We crawl your site and flag anything that returns an error or
        redirect chain.
      </p>
    </div>
  )
}

function PendingState() {
  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center backdrop-blur-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
        <Unlink className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-navy-900">First scan in progress</p>
      <p className="mt-1 text-sm text-navy-600">
        We&apos;re preparing your first link report. Please check back shortly or{' '}
        <a
          href="mailto:hello@woldsdigital.co.uk"
          className="font-semibold text-brand-700 underline-offset-2 hover:underline"
        >
          contact us
        </a>{' '}
        if it doesn&apos;t appear soon.
      </p>
    </div>
  )
}

function BrokenLinksReport({ report }: { report: BrokenLinksResult }) {
  const allClear = report.broken === 0

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Scan summary
          </p>
          <p className="mt-1 text-sm text-navy-600 break-all">
            <span className="text-navy-800">{report.url}</span>
          </p>
        </div>
        <p className="text-xs text-navy-400">
          Audited {new Date(report.audited_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Summary
          label="Links scanned"
          value={report.total_links}
          tone="neutral"
        />
        <Summary
          label="Broken"
          value={report.broken}
          tone={report.broken > 0 ? 'bad' : 'good'}
        />
        <Summary
          label="Redirects"
          value={report.warnings}
          tone={report.warnings > 0 ? 'warn' : 'good'}
        />
      </div>

      {allClear ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-800">All links are working</p>
            <p className="mt-0.5 text-xs text-brand-700">
              Nothing broken at the last scan. Nice.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Broken links ({report.broken_links.length} shown
            {report.broken > report.broken_links.length
              ? ` of ${report.broken}`
              : ''})
          </p>
          <ul className="divide-y divide-navy-100 overflow-hidden rounded-2xl border border-navy-100">
            {report.broken_links.map((l, i) => (
              <li key={i} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <a
                    href={l.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-navy-900 hover:text-brand-700"
                  >
                    <span className="truncate">{l.link}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-navy-400" />
                  </a>
                  <p className="mt-0.5 truncate text-[11px] text-navy-500">
                    found on <span className="text-navy-700">{l.found_on}</span>
                  </p>
                  {l.error && l.error !== `HTTP ${l.status_code}` && (
                    <p className="mt-0.5 truncate text-[11px] text-red-700">{l.error}</p>
                  )}
                </div>
                <span className="shrink-0 self-start rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-700 ring-1 ring-red-200 sm:self-auto">
                  {l.status_code || 'ERR'}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-brand-800">
            Want us to get these fixed?{' '}
            <a
              href="mailto:hello@woldsdigital.co.uk?subject=Broken%20links%20follow-up"
              className="font-semibold underline-offset-2 hover:underline"
            >
              Get in touch
            </a>{' '}
            and we&apos;ll sort it.
          </div>
        </div>
      )}
    </div>
  )
}

function Summary({
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
    neutral: { text: 'text-navy-800',  bg: 'bg-white',     ring: 'ring-navy-100'  },
  }[tone]
  return (
    <div className={`rounded-2xl border border-navy-100 px-4 py-4 text-center ${colour.bg} ring-1 ${colour.ring}`}>
      <p className={`text-3xl font-bold leading-none ${colour.text}`}>{value}</p>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-500">{label}</p>
    </div>
  )
}
