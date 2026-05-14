import 'server-only'

const PLACES_API_BASE = 'https://places.googleapis.com/v1'

export type PlaceSearchResult = {
  placeId: string
  name: string
  address: string
  rating: number | null
  totalReviews: number | null
}

export type PlaceDetails = {
  placeId: string
  name: string
  rating: number | null
  totalReviews: number | null
  reviews: PlaceReview[]
}

export type PlaceReview = {
  externalId: string
  reviewerName: string
  rating: number
  text: string | null
  reviewedAt: Date | null
}

/**
 * Search for a business by name. Used by admin to find and link a Place ID to a site.
 */
export async function searchPlaces(apiKey: string, query: string): Promise<PlaceSearchResult[]> {
  const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: query }),
  })

  if (!response.ok) {
    throw new Error(`Google Places search failed: ${response.statusText}`)
  }

  const data = await response.json()
  const places = data.places ?? []

  return places.map((place: Record<string, unknown>) => ({
    placeId: place.id as string,
    name: (place.displayName as { text: string })?.text ?? '',
    address: (place.formattedAddress as string) ?? '',
    rating: (place.rating as number) ?? null,
    totalReviews: (place.userRatingCount as number) ?? null,
  }))
}

/**
 * Fetch current rating, review count, and recent reviews for a Place ID.
 * Used by the daily cron job.
 */
export async function getPlaceDetails(apiKey: string, placeId: string): Promise<PlaceDetails> {
  const response = await fetch(
    `${PLACES_API_BASE}/places/${placeId}`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'id,displayName,rating,userRatingCount,reviews',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Google Places details failed: ${response.statusText}`)
  }

  const place = await response.json()

  const reviews: PlaceReview[] = (place.reviews ?? []).map(
    (r: Record<string, unknown>) => ({
      externalId: r.name as string,
      reviewerName:
        ((r.authorAttribution as Record<string, unknown>)?.displayName as string) ?? 'Anonymous',
      rating: (r.rating as number) ?? 0,
      text: ((r.text as Record<string, unknown>)?.text as string) ?? null,
      reviewedAt: r.publishTime ? new Date(r.publishTime as string) : null,
    })
  )

  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    rating: place.rating ?? null,
    totalReviews: place.userRatingCount ?? null,
    reviews,
  }
}
