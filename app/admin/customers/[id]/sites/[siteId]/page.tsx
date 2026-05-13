import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { fetchUptimeBySite, type LiveUptime } from '@/lib/integrations/uptime'
import { fetchSeoAuditBySite } from '@/lib/integrations/seo'
import { fetchBrokenLinksBySite, fetchPageSpeedBySite } from '@/lib/integrations/audits'
import type { SeoAuditResult } from '@/lib/integrations/seo-audit'
import type { PageSpeedResult } from '@/lib/integrations/page-speed'
import type { BrokenLinksResult } from '@/lib/integrations/broken-links'
import { hasIntegration } from '@/app/portal/websites/[id]/site-loader'
import { DashboardView } from '@/app/portal/websites/[id]/DashboardView'
import { loadSiteAsAdmin } from '../site-loader'

interface PageProps {
  params: Promise<{ id: string; siteId: string }>
}

export default async function AdminSiteDashboardPage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params
  const site = await loadSiteAsAdmin(siteId, customerId)
  if (!site) notFound()

  const hasSeo         = hasIntegration(site, 'seoscoreapi')
  const hasMonitor     = hasIntegration(site, 'betterstack')
  const hasPageSpeed   = hasIntegration(site, 'pagespeed')
  const hasBrokenLinks = hasIntegration(site, 'brokenlinks')

  const [uptimeMap, seoMap, pageSpeedMap, brokenLinksMap] = await Promise.all([
    hasMonitor     ? fetchUptimeBySite([site.id])      : Promise.resolve(new Map<string, LiveUptime>()),
    hasSeo         ? fetchSeoAuditBySite([site.id])    : Promise.resolve(new Map<string, SeoAuditResult>()),
    hasPageSpeed   ? fetchPageSpeedBySite([site.id])   : Promise.resolve(new Map<string, PageSpeedResult>()),
    hasBrokenLinks ? fetchBrokenLinksBySite([site.id]) : Promise.resolve(new Map<string, BrokenLinksResult>()),
  ])

  return (
    <DashboardView
      basePath={`/admin/customers/${customerId}/sites/${site.id}`}
      hasSeo={hasSeo}
      hasMonitor={hasMonitor}
      hasPageSpeed={hasPageSpeed}
      hasBrokenLinks={hasBrokenLinks}
      uptime={uptimeMap.get(site.id) ?? null}
      audit={seoMap.get(site.id) ?? null}
      pageSpeed={pageSpeedMap.get(site.id) ?? null}
      brokenLinks={brokenLinksMap.get(site.id) ?? null}
    />
  )
}
