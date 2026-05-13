import { notFound } from 'next/navigation'
import { AlertTriangle, CheckCircle2, SearchCheck, XCircle } from 'lucide-react'
import { fetchSeoAuditBySite } from '@/lib/integrations/seo'
import {
  categoryBreakdown,
  scoreColour,
  type SeoAuditResult,
} from '@/lib/integrations/seo-audit'
import { hasIntegration, loadOwnedSite } from '../site-loader'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WebsiteSeoPage({ params }: PageProps) {
  const { id } = await params
  const site   = await loadOwnedSite(id)
  if (!site)                              notFound()
  if (!hasIntegration(site, 'seoscoreapi')) notFound()

  const auditMap = await fetchSeoAuditBySite([site.id])
  const audit    = auditMap.get(site.id) ?? null

  return (
    <div>
      <SectionHeader />

      {!audit ? (
        <PendingState />
      ) : (
        <AuditReport audit={audit} />
      )}
    </div>
  )
}

function SectionHeader() {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
        Search visibility
      </p>
      <p className="mt-1 text-sm text-navy-600">
        Your latest SEO health check, with the highest-impact things to fix next.
      </p>
    </div>
  )
}

function PendingState() {
  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center backdrop-blur-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
        <SearchCheck className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-navy-900">First audit in progress</p>
      <p className="mt-1 text-sm text-navy-600">
        We&apos;re preparing your first SEO report. Please check back shortly or{' '}
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

function AuditReport({ audit }: { audit: SeoAuditResult }) {
  const colour     = scoreColour(audit.score)
  const categories = categoryBreakdown(audit)
  const top        = audit.priorities?.slice(0, 5) ?? []

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl ${colour.bg} ring-1 ${colour.ring}`}
        >
          <span className={`text-3xl font-bold leading-none ${colour.text}`}>
            {audit.score}
          </span>
          <span className={`mt-1 text-[10px] font-bold uppercase tracking-[0.18em] ${colour.text}`}>
            Grade {audit.grade}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Overall SEO score
          </p>
          <p className="mt-1 text-sm text-navy-600">
            Out of 100, based on the latest audit of{' '}
            <span className="break-all text-navy-800">{audit.url}</span>.
          </p>
          <p className="mt-2 text-xs text-navy-400">
            Audited {new Date(audit.audited_at).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {top.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            What to fix next
          </p>
          <ul className="space-y-2">
            {top.map((p, i) => (
              <li
                key={i}
                className="rounded-xl border border-navy-100 bg-navy-50/40 px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-navy-900">{p.issue}</p>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                    {p.impact}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-navy-600">{p.fix}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
          Category breakdown
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(({ key, label, counts }) => (
            <div
              key={key}
              className="rounded-xl border border-navy-100 bg-white px-3 py-2.5"
            >
              <p className="text-xs font-semibold text-navy-800">{label}</p>
              {counts.total === 0 ? (
                <p className="mt-1 text-[10px] text-navy-400">No checks reported</p>
              ) : (
                <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-brand-700">
                    <CheckCircle2 className="h-3 w-3" />
                    {counts.pass}
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    {counts.warning}
                  </span>
                  <span className="inline-flex items-center gap-1 text-red-700">
                    <XCircle className="h-3 w-3" />
                    {counts.fail}
                  </span>
                  <span className="ml-auto text-navy-400">{counts.pass}/{counts.total}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-brand-800">
        Want help improving your score?{' '}
        <a
          href="mailto:hello@woldsdigital.co.uk?subject=SEO%20audit%20follow-up"
          className="font-semibold underline-offset-2 hover:underline"
        >
          Get in touch
        </a>{' '}
        and we&apos;ll plan the next steps together.
      </div>
    </div>
  )
}
