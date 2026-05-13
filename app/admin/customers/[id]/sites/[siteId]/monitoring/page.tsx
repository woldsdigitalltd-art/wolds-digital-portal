import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { fetchUptimeBySite } from '@/lib/integrations/uptime'
import { hasIntegration } from '@/app/portal/websites/[id]/site-loader'
import { MonitoringView } from '@/app/portal/websites/[id]/monitoring/MonitoringView'
import { loadSiteAsAdmin } from '../../site-loader'

interface PageProps {
  params: Promise<{ id: string; siteId: string }>
}

export default async function AdminSiteMonitoringPage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params
  const site = await loadSiteAsAdmin(siteId, customerId)
  if (!site)                              notFound()
  if (!hasIntegration(site, 'betterstack')) notFound()

  const map    = await fetchUptimeBySite([site.id])
  const uptime = map.get(site.id) ?? null

  return <MonitoringView siteId={site.id} uptime={uptime} />
}
