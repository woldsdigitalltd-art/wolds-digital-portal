'use client'

import { useState } from 'react'
import { Star, TrendingUp, MessageSquare } from 'lucide-react'
import type { ReviewSnapshot, Review, SiteWithReviewConfig } from '@/lib/services/review-monitor'
import type { Site } from '@/lib/services/billing'

type SiteData = {
  site: Site
  config: SiteWithReviewConfig | null
  snapshots: ReviewSnapshot[]
  reviews: Review[]
}

type Props = { siteData: SiteData[] }

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < Math.round(rating) ? 'text-brand-400 fill-brand-400' : 'text-navy-200'
          }`}
        />
      ))}
    </div>
  )
}

function SourceBadge({ source }: { source: 'google' | 'trustpilot' }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
      source === 'google'
        ? 'bg-brand-100 text-brand-700'
        : 'bg-navy-100 text-navy-700'
    }`}>
      {source === 'google' ? 'Google' : 'Trustpilot'}
    </span>
  )
}

export default function ReviewMonitorClient({ siteData }: Props) {
  const [activeSiteId, setActiveSiteId] = useState<string>(
    siteData[0]?.site.id ?? ''
  )

  const active = siteData.find(d => d.site.id === activeSiteId)
  const config = active?.config

  const googleSnapshots = active?.snapshots
    .filter(s => s.source === 'google')
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)) ?? []

  const trustpilotSnapshots = active?.snapshots
    .filter(s => s.source === 'trustpilot')
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)) ?? []

  const todayGoogle = googleSnapshots.at(-1)
  const todayTrustpilot = trustpilotSnapshots.at(-1)

  const totalNewToday =
    (todayGoogle?.new_reviews ?? 0) + (todayTrustpilot?.new_reviews ?? 0)

  return (
    <div className="min-h-screen bg-page-gradient font-sans">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

        <header className="py-8 flex items-center gap-3">
          <Star className="h-6 w-6 text-navy-900" />
          <h1 className="text-2xl font-semibold text-navy-900">Review Monitor</h1>
        </header>

        {/* Site selector */}
        {siteData.length > 1 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {siteData.map(({ site }) => (
              <button
                key={site.id}
                onClick={() => setActiveSiteId(site.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeSiteId === site.id
                    ? 'bg-navy-900 text-white'
                    : 'border border-navy-200 text-navy-700 hover:bg-navy-50'
                }`}
              >
                {site.domain}
              </button>
            ))}
          </div>
        )}

        {!config?.google_place_id && !config?.trustpilot_domain ? (
          <div className="rounded-xl bg-white shadow-soft p-8 text-center text-navy-400">
            Review monitoring has not been configured for this site yet.
          </div>
        ) : (
          <div className="space-y-6">

            {/* Score cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {config?.google_place_id && (
                <div className="rounded-xl bg-white shadow-soft p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-navy-500">Google Rating</p>
                    <SourceBadge source="google" />
                  </div>
                  <p className="text-3xl font-semibold text-navy-900">
                    {config.google_current_rating?.toFixed(1) ?? '—'}
                  </p>
                  {config.google_current_rating && (
                    <StarRating rating={config.google_current_rating} />
                  )}
                  <p className="text-xs text-navy-400 mt-1">
                    {config.google_total_reviews.toLocaleString()} total reviews
                  </p>
                </div>
              )}

              {config?.trustpilot_domain && (
                <div className="rounded-xl bg-white shadow-soft p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-navy-500">Trustpilot Score</p>
                    <SourceBadge source="trustpilot" />
                  </div>
                  <p className="text-3xl font-semibold text-navy-900">
                    {config.trustpilot_score?.toFixed(1) ?? '—'}
                  </p>
                  {config.trustpilot_score && (
                    <StarRating rating={config.trustpilot_score} max={5} />
                  )}
                  <p className="text-xs text-navy-400 mt-1">
                    {config.trustpilot_total_reviews.toLocaleString()} total reviews
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-white shadow-soft p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-navy-400" />
                  <p className="text-sm text-navy-500">New today</p>
                </div>
                <p className="text-3xl font-semibold text-navy-900">{totalNewToday}</p>
                <p className="text-xs text-navy-400 mt-1">Across all sources</p>
                {config?.reviews_last_checked_at && (
                  <p className="text-xs text-navy-300 mt-1">
                    Last checked{' '}
                    {new Date(config.reviews_last_checked_at).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
            </div>

            {/* Snapshot trend table */}
            {active?.snapshots && active.snapshots.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-navy-900 mb-3">Daily History</h2>
                <div className="rounded-xl bg-white shadow-soft overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-100 bg-navy-50">
                        <th className="px-6 py-3 text-left font-medium text-navy-600">Date</th>
                        <th className="px-6 py-3 text-left font-medium text-navy-600">Source</th>
                        <th className="px-6 py-3 text-left font-medium text-navy-600">Rating</th>
                        <th className="px-6 py-3 text-left font-medium text-navy-600">Total Reviews</th>
                        <th className="px-6 py-3 text-left font-medium text-navy-600">New</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-50">
                      {[...active.snapshots]
                        .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
                        .map(s => (
                          <tr key={s.id} className="hover:bg-navy-50 transition-colors">
                            <td className="px-6 py-3 text-navy-700">
                              {new Date(s.snapshot_date).toLocaleDateString('en-GB')}
                            </td>
                            <td className="px-6 py-3">
                              <SourceBadge source={s.source} />
                            </td>
                            <td className="px-6 py-3 font-medium text-navy-900">
                              {s.rating?.toFixed(1) ?? '—'}
                            </td>
                            <td className="px-6 py-3 text-navy-700">
                              {s.total_reviews.toLocaleString()}
                            </td>
                            <td className="px-6 py-3">
                              {s.new_reviews > 0 ? (
                                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                                  +{s.new_reviews}
                                </span>
                              ) : (
                                <span className="text-navy-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Individual reviews (full mode only) */}
            {config?.review_tracking_mode === 'full' &&
              active?.reviews &&
              active.reviews.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-navy-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-navy-600" />
                  Reviews
                </h2>
                <div className="space-y-3">
                  {active.reviews.map(r => (
                    <div key={r.id} className="rounded-xl bg-white shadow-soft p-5">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <p className="text-sm font-medium text-navy-900">
                            {r.reviewer_name ?? 'Anonymous'}
                          </p>
                          {r.reviewed_at && (
                            <p className="text-xs text-navy-400">
                              {new Date(r.reviewed_at).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StarRating rating={r.rating} />
                          <SourceBadge source={r.source} />
                        </div>
                      </div>
                      {r.review_text && (
                        <p className="text-sm text-navy-700 leading-relaxed">{r.review_text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
