import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Integration } from '@/lib/integrations/types'
import { loadSiteAsAdmin } from '../../site-loader'
import ServicesPanel, { type SiteIntegrationListItem } from './ServicesPanel'

interface PageProps {
  params: Promise<{ id: string; siteId: string }>
}

interface LinkRow {
  id:                   string
  site_id:              string
  integration_id:       string
  status:               string
  provider_resource_id: string | null
  provider_metadata:    unknown
  last_error:           string | null
  provisioned_at:       string | null
  created_at:           string
  updated_at:           string
  schedule_frequency:    string
  schedule_hour:         number | null
  schedule_day_of_week:  number | null
  schedule_day_of_month: number | null
  schedule_last_run_at:  string | null
  schedule_next_run_at:  string | null
  integration:          { key: string; name: string } | null
}

export const dynamic = 'force-dynamic'

export default async function AdminSiteServicesPage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params
  const site = await loadSiteAsAdmin(siteId, customerId)
  if (!site) notFound()

  const sr = createServiceRoleClient()

  const [intsRes, linksRes] = await Promise.all([
    sr.from('integrations').select('*').eq('enabled', true).order('name', { ascending: true }),
    sr
      .from('site_integrations')
      .select(`
        id, site_id, integration_id, status,
        provider_resource_id, provider_metadata,
        last_error, provisioned_at,
        created_at, updated_at,
        schedule_frequency, schedule_hour,
        schedule_day_of_week, schedule_day_of_month,
        schedule_last_run_at, schedule_next_run_at,
        integration:integrations ( key, name )
      `)
      .eq('site_id', site.id)
      .order('created_at', { ascending: true }),
  ])

  if (intsRes.error)  console.error('services: load integrations failed:',  intsRes.error)
  if (linksRes.error) console.error('services: load site links failed:',    linksRes.error)

  const integrations = (intsRes.data ?? []) as Integration[]
  const links = ((linksRes.data ?? []) as unknown as LinkRow[]).map<SiteIntegrationListItem>(row => {
    const { integration, ...rest } = row
    return {
      ...(rest as unknown as Omit<SiteIntegrationListItem, 'integration_key' | 'integration_name'>),
      integration_key:  integration?.key  ?? '',
      integration_name: integration?.name ?? '',
    }
  })

  return (
    <ServicesPanel
      siteId={site.id}
      initialIntegrations={integrations}
      initialLinks={links}
    />
  )
}
