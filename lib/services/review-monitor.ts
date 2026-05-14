import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getPlaceDetails } from '@/lib/services/google-places'
import { getBusinessUnitDetails } from '@/lib/services/trustpilot'
import { isToday } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewSnapshot = {
  id: string
  site_id: string
  source: 'google' | 'trustpilot'
  snapshot_date: string
  rating: number | null
  total_reviews: number
  new_reviews: number
  created_at: string
}

export type Review = {
  id: string
  site_id: string
  source: 'google' | 'trustpilot'
  external_id: string
  reviewer_name: string | null
  rating: number
  review_text: string | null
  reviewed_at: string | null
  fetched_at: string
}

export type SiteWithReviewConfig = {
  id: string
  domain: string
  owner_id: string
  review_tracking_mode: 'snapshot' | 'full'
  google_place_id: string | null
  trustpilot_domain: string | null
  google_current_rating: number | null
  google_total_reviews: number
  trustpilot_score: number | null
  trustpilot_total_reviews: number
  reviews_last_checked_at: string | null
}

// ─── Site config ──────────────────────────────────────────────────────────────

export async function updateSiteReviewConfig({
  siteId,
  googlePlaceId,
  trustpilotDomain,
  reviewTrackingMode,
}: {
  siteId: string
  googlePlaceId?: string | null
  trustpilotDomain?: string | null
  reviewTrackingMode?: 'snapshot' | 'full'
}): Promise<void> {
  const supabase = await createClient()
  const updates: Record<string, unknown> = {}

  if (googlePlaceId !== undefined) updates.google_place_id = googlePlaceId
  if (trustpilotDomain !== undefined) updates.trustpilot_domain = trustpilotDomain
  if (reviewTrackingMode !== undefined) updates.review_tracking_mode = reviewTrackingMode

  const { error } = await supabase
    .from('sites')
    .update(updates)
    .eq('id', siteId)

  if (error) throw error
}

export async function getSitesWithReviewConfig(): Promise<SiteWithReviewConfig[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sites')
    .select(
      'id, domain, owner_id, review_tracking_mode, google_place_id, trustpilot_domain, google_current_rating, google_total_reviews, trustpilot_score, trustpilot_total_reviews, reviews_last_checked_at'
    )
    .or('google_place_id.not.is.null,trustpilot_domain.not.is.null')

  if (error) throw error
  return data ?? []
}

export async function getSiteReviewConfig(
  siteId: string
): Promise<SiteWithReviewConfig | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sites')
    .select(
      'id, domain, owner_id, review_tracking_mode, google_place_id, trustpilot_domain, google_current_rating, google_total_reviews, trustpilot_score, trustpilot_total_reviews, reviews_last_checked_at'
    )
    .eq('id', siteId)
    .single()

  if (error) throw error
  return data
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export async function getSnapshotsForSite(
  siteId: string,
  source?: 'google' | 'trustpilot',
  limit = 30
): Promise<ReviewSnapshot[]> {
  const supabase = await createClient()
  let query = supabase
    .from('review_snapshots')
    .select('*')
    .eq('site_id', siteId)
    .order('snapshot_date', { ascending: false })
    .limit(limit)

  if (source) query = query.eq('source', source)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ─── Reviews (full mode only) ──────────────────────────────────────────────────

export async function getReviewsForSite(
  siteId: string,
  source?: 'google' | 'trustpilot',
  limit = 50
): Promise<Review[]> {
  const supabase = await createClient()
  let query = supabase
    .from('reviews')
    .select('*')
    .eq('site_id', siteId)
    .order('reviewed_at', { ascending: false })
    .limit(limit)

  if (source) query = query.eq('source', source)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ─── Cron: run daily check for one site ───────────────────────────────────────

export async function runReviewCheckForSite(
  site: SiteWithReviewConfig
): Promise<void> {
  const supabase = await createClient()
  const isFullMode = site.review_tracking_mode === 'full'

  // ── Google ──
  if (site.google_place_id) {
    try {
      const details = await getPlaceDetails(site.google_place_id)

      const previousTotal = site.google_total_reviews ?? 0
      const newTotal = details.totalReviews ?? 0
      const newReviewsCount = Math.max(0, newTotal - previousTotal)

      await supabase.from('review_snapshots').upsert(
        {
          site_id: site.id,
          source: 'google',
          snapshot_date: new Date().toISOString().split('T')[0],
          rating: details.rating,
          total_reviews: newTotal,
          new_reviews: newReviewsCount,
        },
        { onConflict: 'site_id,source,snapshot_date' }
      )

      await supabase
        .from('sites')
        .update({
          google_current_rating: details.rating,
          google_total_reviews: newTotal,
        })
        .eq('id', site.id)

      if (isFullMode && details.reviews.length > 0) {
        const rows = details.reviews
          .filter(r => r.reviewedAt && !isToday(r.reviewedAt))
          .map(r => ({
            site_id: site.id,
            source: 'google' as const,
            external_id: r.externalId,
            reviewer_name: r.reviewerName,
            rating: r.rating,
            review_text: r.text,
            reviewed_at: r.reviewedAt?.toISOString() ?? null,
          }))

        if (rows.length > 0) {
          await supabase
            .from('reviews')
            .upsert(rows, { onConflict: 'site_id,source,external_id', ignoreDuplicates: true })
        }
      }
    } catch (err) {
      console.error(`Google review check failed for site ${site.domain}:`, err)
    }
  }

  // ── Trustpilot ──
  if (site.trustpilot_domain) {
    try {
      const details = await getBusinessUnitDetails(
        site.trustpilot_domain,
        isFullMode
      )

      if (details) {
        const previousTotal = site.trustpilot_total_reviews ?? 0
        const newTotal = details.totalReviews ?? 0
        const newReviewsCount = Math.max(0, newTotal - previousTotal)

        await supabase.from('review_snapshots').upsert(
          {
            site_id: site.id,
            source: 'trustpilot',
            snapshot_date: new Date().toISOString().split('T')[0],
            rating: details.score,
            total_reviews: newTotal,
            new_reviews: newReviewsCount,
          },
          { onConflict: 'site_id,source,snapshot_date' }
        )

        await supabase
          .from('sites')
          .update({
            trustpilot_score: details.score,
            trustpilot_total_reviews: newTotal,
          })
          .eq('id', site.id)

        if (isFullMode && details.reviews.length > 0) {
          const rows = details.reviews.map(r => ({
            site_id: site.id,
            source: 'trustpilot' as const,
            external_id: r.externalId,
            reviewer_name: r.reviewerName,
            rating: r.rating,
            review_text: r.text,
            reviewed_at: r.reviewedAt?.toISOString() ?? null,
          }))

          await supabase
            .from('reviews')
            .upsert(rows, { onConflict: 'site_id,source,external_id', ignoreDuplicates: true })
        }
      }
    } catch (err) {
      console.error(`Trustpilot review check failed for site ${site.domain}:`, err)
    }
  }

  await supabase
    .from('sites')
    .update({ reviews_last_checked_at: new Date().toISOString() })
    .eq('id', site.id)
}
