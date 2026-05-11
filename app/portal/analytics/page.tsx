import { createClient } from '@/lib/supabase/server'
import { BarChart3, ExternalLink } from 'lucide-react'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: portalData } = await supabase.rpc('get_my_portal_data')
  const site = portalData?.sites?.[0]?.site

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Traffic and visitor data for {site?.domain ?? 'your website'}.
        </p>
      </div>

      {site?.ga_property_id ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Google Analytics</span>
            </div>
            <a
              href={`https://analytics.google.com/analytics/web/#/p${site.ga_property_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Open in GA4 <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="p-6">
            <p className="text-slate-500 text-sm text-center py-8">
              Analytics embed coming soon. Your property ID is{' '}
              <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">
                {site.ga_property_id}
              </code>
              .
            </p>
          </div>
        </div>
      ) : site?.plausible_domain ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">Plausible Analytics</span>
          </div>
          <iframe
            src={`https://plausible.io/${site.plausible_domain}/embed`}
            className="w-full h-[600px] border-0"
            title="Site analytics"
          />
        </div>
      ) : (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            Analytics haven&apos;t been configured yet.{' '}
            <a href="mailto:hello@woldsdigital.com" className="text-brand-600 hover:underline">
              Contact us
            </a>{' '}
            to get this set up.
          </p>
        </div>
      )}
    </div>
  )
}
