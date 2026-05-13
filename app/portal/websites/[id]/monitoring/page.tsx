import { notFound } from 'next/navigation'
import { fetchUptimeBySite } from '@/lib/integrations/uptime'
import { hasIntegration, loadOwnedSite } from '../site-loader'
import { MonitoringView } from './MonitoringView'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WebsiteMonitoringPage({ params }: PageProps) {
  const { id } = await params
  const site   = await loadOwnedSite(id)
  if (!site)                              notFound()
  if (!hasIntegration(site, 'betterstack')) notFound()

  const uptimeMap = await fetchUptimeBySite([site.id])
  const uptime    = uptimeMap.get(site.id) ?? null

  return <MonitoringView siteId={site.id} uptime={uptime} />
}
