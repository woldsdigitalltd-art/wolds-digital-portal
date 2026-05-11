import { createClient } from '@/lib/supabase/server'
import { Megaphone, ExternalLink, Plug } from 'lucide-react'

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: portalData } = await supabase.rpc('get_my_portal_data')
  const buffer = portalData?.sites?.[0]?.buffer

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">What&apos;s on</h1>
        <p className="text-slate-500 text-sm mt-1">
          Schedule posts that appear on your website&apos;s &ldquo;What&apos;s On&rdquo; page.
        </p>
      </div>

      {buffer ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <Plug className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Buffer connected</p>
                <p className="text-xs text-slate-500">Organisation: {buffer.organization_id}</p>
              </div>
            </div>
            <a
              href="https://publish.buffer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Open Buffer <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium text-sm mb-1">Post scheduler coming soon</p>
            <p className="text-slate-400 text-xs">
              You&apos;ll be able to draft, schedule and manage posts here.<br />
              For now, use Buffer directly — your posts will still appear on your site.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            Your Buffer account hasn&apos;t been connected yet.{' '}
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
