import { createClient } from '@/lib/supabase/server'
import { Megaphone, ExternalLink, Plug } from 'lucide-react'

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: portalData } = await supabase.rpc('get_my_portal_data')
  const buffer = portalData?.sites?.[0]?.buffer

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">
          Content
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          What&apos;s on<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Schedule posts that appear on your website&apos;s &ldquo;What&apos;s On&rdquo; page.
        </p>
      </div>

      {buffer ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-navy-100 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <Plug className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-900">Buffer connected</p>
                <p className="text-xs text-navy-500">Organisation: {buffer.organization_id}</p>
              </div>
            </div>
            <a
              href="https://publish.buffer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500 transition hover:text-brand-700"
            >
              Open Buffer <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-2xl border border-navy-100 bg-white p-10 text-center shadow-soft">
            <Megaphone className="mx-auto mb-3 h-8 w-8 text-brand-500" />
            <p className="text-sm font-semibold text-navy-900">Post scheduler coming soon</p>
            <p className="mt-2 text-xs text-navy-500">
              You&apos;ll be able to draft, schedule and manage posts here.
              <br />
              For now, use Buffer directly — your posts will still appear on your site.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
          <Megaphone className="mx-auto mb-3 h-8 w-8 text-navy-300" />
          <p className="text-sm text-navy-600">
            Your Buffer account hasn&apos;t been connected yet.{' '}
            <a
              href="mailto:hello@woldsdigital.co.uk"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Contact us
            </a>{' '}
            to get this set up.
          </p>
        </div>
      )}
    </div>
  )
}
