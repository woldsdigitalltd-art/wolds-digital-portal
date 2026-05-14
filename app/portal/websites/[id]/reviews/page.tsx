import { notFound } from 'next/navigation'
import { hasIntegration, loadOwnedSite } from '../site-loader'
import {
  getSiteReviewConfig,
  getSnapshotsForSite,
  getReviewsForSite,
} from '@/lib/services/review-monitor'
import { ReviewsView } from './ReviewsView'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WebsiteReviewsPage({ params }: PageProps) {
  const { id }  = await params
  const site    = await loadOwnedSite(id)
  const hasGoogle     = site && hasIntegration(site, 'google_places')
  const hasTrustpilot = site && hasIntegration(site, 'trustpilot')
  if (!site || (!hasGoogle && !hasTrustpilot)) notFound()

  const config = await getSiteReviewConfig(id)

  const [snapshots, reviews] = await Promise.all([
    getSnapshotsForSite(id, undefined, 60),
    config?.review_tracking_mode === 'full'
      ? getReviewsForSite(id, undefined, 100)
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
