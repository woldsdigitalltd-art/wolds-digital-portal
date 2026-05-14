import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { hasIntegration } from '@/app/portal/websites/[id]/site-loader'
import { loadSiteAsAdmin } from '../../site-loader'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SiteWithReviewConfig, ReviewSnapshot, Review } from '@/lib/services/review-monitor'
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

  // Use service-role client so RLS doesn't block reading another user's site row.
  const admin = createAdminClient()
  const { data: config } = await admin
    .from('sites')
    .select('id, domain, owner_id, review_tracking_mode, google_place_id, trustpilot_domain, google_current_rating, google_total_reviews, trustpilot_score, trustpilot_total_reviews, reviews_last_checked_at')
    .eq('id', siteId)
    .maybeSingle() as { data: SiteWithReviewConfig | null }

  const [{ data: snapshotRows }, { data: reviewRows }] = await Promise.all([
    admin.from('review_snapshots').select('*').eq('site_id', siteId).order('snapshot_date', { ascending: false }).limit(60),
    config?.review_tracking_mode === 'full'
      ? admin.from('reviews').select('*').eq('site_id', siteId).order('reviewed_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
  ])
  const snapshots = (snapshotRows ?? []) as ReviewSnapshot[]
  const reviews   = (reviewRows   ?? []) as Review[]

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
