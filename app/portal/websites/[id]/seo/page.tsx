import { notFound } from 'next/navigation'
import { fetchSeoAuditBySite } from '@/lib/integrations/seo'
import { loadAuditSchedule } from '@/lib/integrations/schedule-loader'
import { hasIntegration, loadOwnedSite } from '../site-loader'
import { SeoView } from './SeoView'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WebsiteSeoPage({ params }: PageProps) {
  const { id } = await params
  const site   = await loadOwnedSite(id)
  if (!site)                              notFound()
  if (!hasIntegration(site, 'seoscoreapi')) notFound()

  const [auditMap, schedule] = await Promise.all([
    fetchSeoAuditBySite([site.id]),
    loadAuditSchedule(site.id, 'seoscoreapi'),
  ])
  const audit = auditMap.get(site.id) ?? null

  return <SeoView audit={audit} schedule={schedule} />
}
