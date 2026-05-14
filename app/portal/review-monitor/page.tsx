import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOwnerSites } from '@/lib/services/billing'
import {
  getSnapshotsForSite,
  getReviewsForSite,
  getSiteReviewConfig,
} from '@/lib/services/review-monitor'
import ReviewMonitorClient from './ReviewMonitorClient'

export const metadata = { title: 'Review Monitor — Portal' }

export default async function ReviewMonitorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const sites = await getOwnerSites(user.id)

  const siteData = await Promise.all(
    sites.map(async site => {
      const config = await getSiteReviewConfig(site.id)
      if (!config?.google_place_id && !config?.trustpilot_domain) {
        return { site, config, snapshots: [], reviews: [] }
      }

      const [snapshots, reviews] = await Promise.all([
        getSnapshotsForSite(site.id, undefined, 30),
        config.review_tracking_mode === 'full'
          ? getReviewsForSite(site.id, undefined, 50)
          : Promise.resolve([]),
      ])

      return { site, config, snapshots, reviews }
    })
  )

  return <ReviewMonitorClient siteData={siteData} />
}
