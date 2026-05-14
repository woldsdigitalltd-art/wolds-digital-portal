'use client'

import { MessageSquare, Star, TrendingUp } from 'lucide-react'
import type {
  Review,
  ReviewSnapshot,
  SiteWithReviewConfig,
} from '@/lib/services/review-monitor'

interface Props {
  config:        SiteWithReviewConfig | null
  snapshots:     ReviewSnapshot[]
  reviews:       Review[]
  hasGoogle:     boolean
  hasTrustpilot: boolean
}

export function ReviewsView({ config, snapshots, reviews, hasGoogle, hasTrustpilot }: Props) {
  const googleSnaps = snapshots
    .filter(s => s.source === 'google')
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

  const trustpilotSnaps = snapshots
    .filter(s => s.source === 'trustpilot')
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

  const latestGoogle     = googleSnaps.at(-1)
  const latestTrustpilot = trustpilotSnaps.at(-1)
  const totalNewToday    = (latestGoogle?.new_reviews ?? 0) + (latestTrustpilot?.new_reviews ?? 0)

  if (!config?.google_place_id && !config?.trustpilot_domain) {
    return (
      <div className="rounded-xl border border-dashed border-navy-200 bg-white/60 px-4 py-10 text-center text-sm text-navy-500">
        Review data will appear here once the first daily check has run.
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Score cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {hasGoogle && config?.google_place_id && (
          <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-navy-500">Google Rating</p>
              <SourceBadge source="google" />
            </div>
            <p className="text-3xl font-bold text-navy-900">
              {config.google_current_rating?.toFixed(1) ?? '—'}
            </p>
            {config.google_current_rating && (
              <StarRating rating={config.google_current_rating} />
            )}
            <p className="mt-1 text-xs text-navy-400">
              {config.google_total_reviews.toLocaleString()} total reviews
            </p>
          </div>
        )}

        {hasTrustpilot && config?.trustpilot_domain && (
          <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-navy-500">Trustpilot Score</p>
              <SourceBadge source="trustpilot" />
            </div>
            <p className="text-3xl font-bold text-navy-900">
              {config.trustpilot_score?.toFixed(1) ?? '—'}
            </p>
            {config.trustpilot_score && (
              <StarRating rating={config.trustpilot_score} />
            )}
            <p className="mt-1 text-xs text-navy-400">
              {config.trustpilot_total_reviews.toLocaleString()} total reviews
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-navy-400" />
            <p className="text-sm text-navy-500">New today</p>
          </div>
          <p className="text-3xl font-bold text-navy-900">{totalNewToday}</p>
          <p className="mt-1 text-xs text-navy-400">Across all sources</p>
          {config?.reviews_last_checked_at && (
            <p className="mt-1 text-[10px] text-navy-300">
              Last checked{' '}
              {new Date(config.reviews_last_checked_at).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>
      </div>

      {/* Daily history */}
      {snapshots.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-navy-900">Daily history</h2>
          <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-500">Date</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-500">Source</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-500">Rating</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-500">Total</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-500">New</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {[...snapshots]
                  .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
                  .map(s => (
                    <tr key={s.id} className="transition-colors hover:bg-navy-50/40">
                      <td className="px-5 py-3 text-navy-700">
                        {new Date(s.snapshot_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-5 py-3">
                        <SourceBadge source={s.source} />
                      </td>
                      <td className="px-5 py-3 font-medium text-navy-900">
                        {s.rating?.toFixed(1) ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-navy-700">
                        {s.total_reviews.toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        {s.new_reviews > 0 ? (
                          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
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
      {config?.review_tracking_mode === 'full' && reviews.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900">
            <MessageSquare className="h-4 w-4 text-navy-500" />
            Individual reviews
          </h2>
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="rounded-2xl border border-navy-100 bg-white p-4 shadow-soft">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">
                      {r.reviewer_name ?? 'Anonymous'}
                    </p>
                    {r.reviewed_at && (
                      <p className="text-[11px] text-navy-400">
                        {new Date(r.reviewed_at).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StarRating rating={r.rating} />
                    <SourceBadge source={r.source} />
                  </div>
                </div>
                {r.review_text && (
                  <p className="text-sm leading-relaxed text-navy-700">{r.review_text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < Math.round(rating) ? 'fill-brand-400 text-brand-400' : 'text-navy-200'
          }`}
        />
      ))}
    </div>
  )
}

function SourceBadge({ source }: { source: 'google' | 'trustpilot' }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        source === 'google'
          ? 'bg-brand-100 text-brand-700'
          : 'bg-navy-100 text-navy-700'
      }`}
    >
      {source === 'google' ? 'Google' : 'Trustpilot'}
    </span>
  )
}
