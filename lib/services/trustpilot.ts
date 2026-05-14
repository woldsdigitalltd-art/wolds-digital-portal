import 'server-only'

const TRUSTPILOT_API_BASE = 'https://api.trustpilot.com/v1'

export type TrustpilotBusinessUnit = {
  businessUnitId: string
  name: string
  domain: string
  score: number | null
  stars: number | null
  totalReviews: number | null
}

export type TrustpilotReview = {
  externalId: string
  reviewerName: string
  rating: number
  text: string | null
  reviewedAt: Date | null
}

export type TrustpilotDetails = {
  businessUnitId: string
  score: number | null
  stars: number | null
  totalReviews: number | null
  reviews: TrustpilotReview[]
}

/**
 * Look up a Trustpilot business unit by domain.
 * Used by admin when configuring a site.
 */
export async function findBusinessUnit(
  apiKey: string,
  domain: string
): Promise<TrustpilotBusinessUnit | null> {
  const response = await fetch(
    `${TRUSTPILOT_API_BASE}/business-units/find?name=${encodeURIComponent(domain)}`,
    {
      headers: { apikey: apiKey },
    }
  )

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Trustpilot business unit lookup failed: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    businessUnitId: data.id,
    name: data.displayName ?? '',
    domain: data.name?.referring?.toLowerCase() ?? domain,
    score: data.score?.trustScore ?? null,
    stars: data.score?.stars ?? null,
    totalReviews: data.numberOfReviews?.total ?? null,
  }
}

/**
 * Fetch current score and recent reviews for a business unit.
 * Used by the daily cron job.
 */
export async function getBusinessUnitDetails(
  apiKey: string,
  domain: string,
  fetchReviews = false
): Promise<TrustpilotDetails | null> {
  const unit = await findBusinessUnit(apiKey, domain)
  if (!unit) return null

  const summaryRes = await fetch(
    `${TRUSTPILOT_API_BASE}/business-units/${unit.businessUnitId}`,
    { headers: { apikey: apiKey } }
  )

  if (!summaryRes.ok) {
    throw new Error(`Trustpilot summary fetch failed: ${summaryRes.statusText}`)
  }

  const summary = await summaryRes.json()

  let reviews: TrustpilotReview[] = []

  if (fetchReviews) {
    const reviewsRes = await fetch(
      `${TRUSTPILOT_API_BASE}/business-units/${unit.businessUnitId}/reviews?perPage=20&orderBy=createdat.desc`,
      { headers: { apikey: apiKey } }
    )

    if (reviewsRes.ok) {
      const reviewData = await reviewsRes.json()
      reviews = (reviewData.reviews ?? []).map((r: Record<string, unknown>) => ({
        externalId: r.id as string,
        reviewerName:
          ((r.consumer as Record<string, unknown>)?.displayName as string) ?? 'Anonymous',
        rating: r.stars as number,
        text: (r.text as string) ?? null,
        reviewedAt: r.createdAt ? new Date(r.createdAt as string) : null,
      }))
    }
  }

  return {
    businessUnitId: unit.businessUnitId,
    score: summary.score?.trustScore ?? null,
    stars: summary.score?.stars ?? null,
    totalReviews: summary.numberOfReviews?.total ?? null,
    reviews,
  }
}
