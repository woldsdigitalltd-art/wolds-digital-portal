import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { fetchBrokenLinksBySite } from '@/lib/integrations/audits'
import { loadAuditSchedule } from '@/lib/integrations/schedule-loader'
import { hasIntegration } from '@/app/portal/websites/[id]/site-loader'
import { BrokenLinksView } from '@/app/portal/websites/[id]/broken-links/BrokenLinksView'
import { loadSiteAsAdmin } from '../../site-loader'

interface PageProps {
  params: Promise<{ id: string; siteId: string }>
}

export default async function AdminSiteBrokenLinksPage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params
  const site = await loadSiteAsAdmin(siteId, customerId)
  if (!site)                              notFound()
  if (!hasIntegration(site, 'brokenlinks')) notFound()

  const [map, schedule] = await Promise.all([
    fetchBrokenLinksBySite([site.id]),
    loadAuditSchedule(site.id, 'brokenlinks'),
  ])
  const report = map.get(site.id) ?? null

  return <BrokenLinksView report={report} schedule={schedule} />
}
