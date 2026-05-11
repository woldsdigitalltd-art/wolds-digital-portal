import { createClient } from '@/lib/supabase/server'
import { BarChart3, ExternalLink } from 'lucide-react'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: portalData } = await supabase.rpc('get_my_portal_data')
  const site = portalData?.sites?.[0]?.site

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">
          Analytics
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          Traffic insights<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Visitors and traffic data for {site?.domain ?? 'your website'}.
        </p>
      </div>

      {site?.ga_property_id ? (
        <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-semibold text-navy-900">Google Analytics</span>
            </div>
            <a
              href={`https://analytics.google.com/analytics/web/#/p${site.ga_property_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500 transition hover:text-brand-700"
            >
              Open in GA4 <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="p-8 text-center">
            <p className="text-sm text-navy-600">
              Analytics embed coming soon. Your property ID is{' '}
              <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-xs text-navy-800">
                {site.ga_property_id}
              </code>
              .
            </p>
          </div>
        </div>
      ) : site?.plausible_domain ? (
        <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft">
          <div className="border-b border-navy-100 px-6 py-4">
            <span className="text-sm font-semibold text-navy-900">Plausible Analytics</span>
          </div>
          <iframe
            src={`https://plausible.io/${site.plausible_domain}/embed`}
            className="h-[600px] w-full border-0"
            title="Site analytics"
          />
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          message="Analytics haven't been configured yet."
        />
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-navy-300" />
      <p className="text-sm text-navy-600">
        {message}{' '}
        <a
          href="mailto:hello@woldsdigital.co.uk"
          className="font-semibold text-brand-700 underline-offset-2 hover:underline"
        >
          Contact us
        </a>{' '}
        to get this set up.
      </p>
    </div>
  )
}
