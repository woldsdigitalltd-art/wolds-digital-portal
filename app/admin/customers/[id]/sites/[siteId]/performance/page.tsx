import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { fetchPageSpeedBySite } from '@/lib/integrations/audits'
import { loadAuditSchedule } from '@/lib/integrations/schedule-loader'
import { hasIntegration } from '@/app/portal/websites/[id]/site-loader'
import { PerformanceView } from '@/app/portal/websites/[id]/performance/PerformanceView'
import { loadSiteAsAdmin } from '../../site-loader'

interface PageProps {
  params: Promise<{ id: string; siteId: string }>
}

export default async function AdminSitePerformancePage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params
  const site = await loadSiteAsAdmin(siteId, customerId)
  if (!site)                            notFound()
  if (!hasIntegration(site, 'pagespeed')) notFound()

  const [map, schedule] = await Promise.all([
    fetchPageSpeedBySite([site.id]),
    loadAuditSchedule(site.id, 'pagespeed'),
  ])
  const report = map.get(site.id) ?? null

  return <PerformanceView report={report} schedule={schedule} />
}
