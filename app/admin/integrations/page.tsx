import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { maskPasswordFields } from '@/lib/integrations/types'
import type { Integration } from '@/lib/integrations/types'
import { Boxes } from 'lucide-react'
import IntegrationsList from './IntegrationsList'

export const dynamic = 'force-dynamic'

export default async function AdminIntegrationsPage() {
  const sr = createServiceRoleClient()
  const { data, error } = await sr
    .from('integrations')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Couldn&apos;t load integrations: {error.message}
          </p>
          <p className="mt-3 text-xs text-red-600">
            Make sure the <code>integrations</code> and{' '}
            <code>site_integrations</code> tables exist.
          </p>
        </div>
      </div>
    )
  }

  const integrations = ((data ?? []) as Integration[]).map(maskPasswordFields)

  return (
    <div>
      <PageHeader />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 shadow-soft">
        <Boxes className="h-3.5 w-3.5 text-brand-600" />
        {integrations.length.toLocaleString('en-GB')} integration{integrations.length === 1 ? '' : 's'}
      </div>

      {integrations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
          <Boxes className="mx-auto mb-3 h-8 w-8 text-navy-300" />
          <p className="text-sm text-navy-600">
            No integrations are seeded in the database yet. Run the
            seed SQL to add Better Stack.
          </p>
        </div>
      ) : (
        <IntegrationsList initialIntegrations={integrations} />
      )}
    </div>
  )
}

function PageHeader() {
  return (
    <div className="mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
        Admin
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
        Integrations<span className="text-brand-500">.</span>
      </h1>
      <p className="mt-2 text-sm text-navy-600 md:text-base">
        Connect a provider once here, then attach it to individual
        sites from the customer page.
      </p>
    </div>
  )
}
