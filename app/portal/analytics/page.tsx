import { createClient } from '@/lib/supabase/server'
import { BarChart3 } from 'lucide-react'

interface WebsiteService {
  id:          string
  key:         string
  name:        string
  icon:        string | null
  description: string | null
}

interface Website {
  id:           string
  domain:       string
  display_name: string | null
  services:     WebsiteService[]
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_websites')
  if (error) {
    console.error('get_my_websites failed (analytics page):', error)
  }
  const sites    = (data ?? []) as Website[]
  const withAnalytics = sites.filter(s => s.services.some(svc => svc.key === 'analytics'))

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
          {withAnalytics.length === 0
            ? 'Analytics haven\u2019t been configured for any of your sites yet.'
            : 'Analytics are configured for the sites listed below.'}
        </p>
      </div>

      {withAnalytics.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {withAnalytics.map(site => (
            <li
              key={site.id}
              className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft"
            >
              <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy-900">
                    {site.display_name?.trim() || site.domain}
                  </p>
                  {site.display_name?.trim() && (
                    <p className="truncate text-xs text-navy-500">{site.domain}</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                  <BarChart3 className="h-3 w-3" />
                  Configured
                </span>
              </div>
              <div className="p-8 text-center">
                <p className="text-sm text-navy-600">
                  Embedded reporting is on its way. We&apos;ll surface your traffic data
                  here as soon as the dashboard is built.
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
      <BarChart3 className="mx-auto mb-3 h-8 w-8 text-navy-300" />
      <p className="text-sm text-navy-600">
        Analytics haven&apos;t been configured yet.{' '}
        <a
          href="mailto:hello@woldsdigital.com"
          className="font-semibold text-brand-700 underline-offset-2 hover:underline"
        >
          Contact us
        </a>{' '}
        to get this set up.
      </p>
    </div>
  )
}
