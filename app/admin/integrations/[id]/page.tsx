import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Integration } from '@/lib/integrations/types'
import IntegrationEditor from './IntegrationEditor'

interface PageProps {
  params: Promise<{ id: string }>
}

const SAFE_COLUMNS = `
  id, key, name, description, icon, provider, provider_url,
  provisioning_required, embed_enabled, enabled, sort_order,
  created_at, updated_at
`

export default async function AdminIntegrationDetailPage({ params }: PageProps) {
  const { id } = await params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('integrations')
    .select(SAFE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return (
      <div>
        <BackLink />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">Couldn&apos;t load integration: {error.message}</p>
        </div>
      </div>
    )
  }
  if (!data) notFound()

  return (
    <div>
      <BackLink />
      <IntegrationEditor initialIntegration={data as Integration} />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/admin/integrations"
      className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500 transition hover:text-brand-700"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to integrations
    </Link>
  )
}
