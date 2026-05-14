import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { hasIntegration } from '@/app/portal/websites/[id]/site-loader'
import { loadSiteAsAdmin } from '../../site-loader'
import {
  getSiteReviewConfig,
  getSnapshotsForSite,
  getReviewsForSite,
} from '@/lib/services/review-monitor'
import { ReviewsView } from '@/app/portal/websites/[id]/reviews/ReviewsView'

interface PageProps {
  params: Promise<{ id: string; siteId: string }>
}

export default async function AdminReviewsPage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params

  const site          = await loadSiteAsAdmin(siteId, customerId)
  const hasGoogle     = site && hasIntegration(site, 'google_places')
  const hasTrustpilot = site && hasIntegration(site, 'trustpilot')
  if (!site || (!hasGoogle && !hasTrustpilot)) notFound()

  const config = await getSiteReviewConfig(siteId)

  const [snapshots, reviews] = await Promise.all([
    getSnapshotsForSite(siteId, undefined, 60),
    config?.review_tracking_mode === 'full'
      ? getReviewsForSite(siteId, undefined, 100)
      : Promise.resolve([]),
  ])

  return (
    <ReviewsView
      config={config}
      snapshots={snapshots}
      reviews={reviews}
      hasGoogle={!!hasGoogle}
      hasTrustpilot={!!hasTrustpilot}
    />
  )
}
