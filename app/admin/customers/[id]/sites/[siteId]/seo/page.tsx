import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { fetchSeoAuditBySite } from '@/lib/integrations/seo'
import { loadAuditSchedule } from '@/lib/integrations/schedule-loader'
import { hasIntegration } from '@/app/portal/websites/[id]/site-loader'
import { SeoView } from '@/app/portal/websites/[id]/seo/SeoView'
import { loadSiteAsAdmin } from '../../site-loader'

interface PageProps {
  params: Promise<{ id: string; siteId: string }>
}

export default async function AdminSiteSeoPage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params
  const site = await loadSiteAsAdmin(siteId, customerId)
  if (!site)                              notFound()
  if (!hasIntegration(site, 'seoscoreapi')) notFound()

  const [map, schedule] = await Promise.all([
    fetchSeoAuditBySite([site.id]),
    loadAuditSchedule(site.id, 'seoscoreapi'),
  ])
  const audit = map.get(site.id) ?? null

  return <SeoView audit={audit} schedule={schedule} />
}
