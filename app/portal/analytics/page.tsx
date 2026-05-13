import { BarChart3 } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Analytics
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          Traffic insights<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Embedded reporting is on its way.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-navy-300" />
        <p className="text-sm text-navy-600">
          We&apos;ll surface traffic data here as soon as the dashboard is built.{' '}
          <a
            href="mailto:hello@woldsdigital.com"
            className="font-semibold text-brand-700 underline-offset-2 hover:underline"
          >
            Contact us
          </a>{' '}
          if you&apos;d like an early look.
        </p>
      </div>
    </div>
  )
}
