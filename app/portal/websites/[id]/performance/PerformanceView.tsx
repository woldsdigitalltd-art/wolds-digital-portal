import { CalendarClock, Gauge } from 'lucide-react'
import {
  formatVital,
  lighthouseColour,
  SCORE_CATEGORIES,
  vitalColour,
  type CoreWebVital,
  type PageSpeedResult,
} from '@/lib/integrations/page-speed'
import { describeSchedule, type ScheduleInput } from '@/lib/integrations/schedule'

export interface PerformanceViewSchedule extends ScheduleInput {
  next_run_at: string | null
}

export function PerformanceView({
  report, schedule,
}: {
  report:    PageSpeedResult | null
  schedule?: PerformanceViewSchedule | null
}) {
  return (
    <div>
      <SectionHeader schedule={schedule} />

      {!report ? <PendingState /> : <PageSpeedReport report={report} />}
    </div>
  )
}

function SectionHeader({ schedule }: { schedule?: PerformanceViewSchedule | null }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
        Performance
      </p>
      <p className="mt-1 text-sm text-navy-600">
        Lighthouse scores, Core Web Vitals, and the biggest wins to make
        your site faster.
      </p>
      {schedule?.next_run_at && schedule.frequency !== 'off' && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-navy-500">
          <CalendarClock className="h-3 w-3" />
          {describeSchedule(schedule)}
          <span className="text-navy-400">
            · next {new Date(schedule.next_run_at).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </p>
      )}
    </div>
  )
}

function PendingState() {
  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center backdrop-blur-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
        <Gauge className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-navy-900">First audit in progress</p>
      <p className="mt-1 text-sm text-navy-600">
        We&apos;re preparing your first performance report. Please check back shortly or{' '}
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

function PageSpeedReport({ report }: { report: PageSpeedResult }) {
  const performance = report.scores.performance
  const perfColour  = lighthouseColour(performance)
  const top         = report.opportunities.slice(0, 3)

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl ${perfColour.bg} ring-1 ${perfColour.ring}`}
        >
          <span className={`text-3xl font-bold leading-none ${perfColour.text}`}>
            {performance}
          </span>
          <span className={`mt-1 text-[10px] font-bold uppercase tracking-[0.18em] ${perfColour.text}`}>
            /100
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Performance score
          </p>
          <p className="mt-1 text-sm text-navy-600">
            Lighthouse desktop audit of{' '}
            <span className="break-all text-navy-800">{report.url}</span>.
          </p>
          <p className="mt-2 text-xs text-navy-400">
            Audited {new Date(report.audited_at).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
          All categories
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SCORE_CATEGORIES.map(({ key, label }) => {
            const s = report.scores[key]
            const c = lighthouseColour(s)
            return (
              <div
                key={key}
                className="rounded-xl border border-navy-100 bg-white px-3 py-4 text-center"
              >
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${c.bg} ring-1 ${c.ring}`}>
                  <span className={`text-lg font-bold leading-none ${c.text}`}>{s}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-navy-800">{label}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
          Core Web Vitals
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Vital label="Largest Contentful Paint"  short="LCP" vital={report.core_web_vitals.lcp} />
          <Vital label="Cumulative Layout Shift"   short="CLS" vital={report.core_web_vitals.cls} />
          <Vital label="Total Blocking Time"       short="TBT" vital={report.core_web_vitals.fid} />
        </div>
      </div>

      {top.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Top opportunities
          </p>
          <ul className="space-y-2">
            {top.map(op => (
              <li
                key={op.id}
                className="rounded-xl border border-navy-100 bg-navy-50/40 px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-navy-900">{op.title}</p>
                  {op.savings_ms !== undefined && op.savings_ms > 0 && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-100">
                      Save {Math.round(op.savings_ms)}ms
                    </span>
                  )}
                </div>
                {op.description && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-navy-600">
                    {op.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-brand-800">
        Want help making your site faster?{' '}
        <a
          href="mailto:hello@woldsdigital.co.uk?subject=Performance%20audit%20follow-up"
          className="font-semibold underline-offset-2 hover:underline"
        >
          Get in touch
        </a>{' '}
        and we&apos;ll plan the next steps together.
      </div>
    </div>
  )
}

function Vital({
  label, short, vital,
}: {
  label: string
  short: string
  vital: CoreWebVital
}) {
  const colour = vitalColour(vital.status)
  return (
    <div className="rounded-xl border border-navy-100 bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">{short}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colour.bg} ${colour.text} ring-1 ${colour.ring}`}>
          {colour.label}
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-navy-900">{formatVital(vital)}</p>
      <p className="mt-0.5 text-[11px] text-navy-500">{label}</p>
    </div>
  )
}
