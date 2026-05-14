'use client'

import { useState } from 'react'
import { Search, Star, RefreshCw, CheckCircle } from 'lucide-react'
import type { Site } from '@/lib/services/billing'

type SiteWithOwner = Site & {
  profiles: { full_name: string | null; company_name: string | null }
  google_place_id?: string | null
  trustpilot_domain?: string | null
  review_tracking_mode?: string | null
  google_current_rating?: number | null
  trustpilot_score?: number | null
}

type PlaceResult = {
  placeId: string
  name: string
  address: string
  rating: number | null
  totalReviews: number | null
}

type Props = { sites: SiteWithOwner[] }

export default function AdminReviewMonitorClient({ sites }: Props) {
  const [selectedSite, setSelectedSite] = useState<SiteWithOwner | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [trustpilotInput, setTrustpilotInput] = useState('')
  const [trackingMode, setTrackingMode] = useState<'snapshot' | 'full'>('snapshot')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function selectSite(site: SiteWithOwner) {
    setSelectedSite(site)
    setSelectedPlace(null)
    setSearchResults([])
    setSearchQuery('')
    setTrustpilotInput(site.trustpilot_domain ?? '')
    setTrackingMode((site.review_tracking_mode as 'snapshot' | 'full') ?? 'snapshot')
    setMessage(null)
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const res = await fetch(`/api/reviews/search-places?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.results ?? [])
    } finally {
      setSearching(false)
    }
  }

  async function handleSave() {
    if (!selectedSite) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/reviews/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: selectedSite.id,
          googlePlaceId: selectedPlace?.placeId ?? selectedSite.google_place_id ?? null,
          trustpilotDomain: trustpilotInput.trim() || null,
          reviewTrackingMode: trackingMode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Review monitor configuration saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-page-gradient font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="py-8 flex items-center gap-3">
          <Star className="h-6 w-6 text-navy-900" />
          <h1 className="text-2xl font-semibold text-navy-900">Review Monitor</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Site list */}
          <div className="rounded-xl bg-white shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-100 bg-navy-50">
              <p className="text-sm font-medium text-navy-700">Sites</p>
            </div>
            <ul className="divide-y divide-navy-50">
              {sites.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => selectSite(s)}
                    className={`w-full text-left px-4 py-3 hover:bg-navy-50 transition-colors ${
                      selectedSite?.id === s.id ? 'bg-navy-50' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-navy-900">{s.domain}</p>
                    <p className="text-xs text-navy-400">
                      {s.profiles.company_name ?? s.profiles.full_name ?? 'Unknown owner'}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {s.google_place_id && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
                          Google ✓
                        </span>
                      )}
                      {s.trustpilot_domain && (
                        <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-700">
                          Trustpilot ✓
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Config panel */}
          <div className="lg:col-span-2">
            {!selectedSite ? (
              <div className="rounded-xl bg-white shadow-soft p-8 text-center text-navy-400">
                Select a site to configure its review sources
              </div>
            ) : (
              <div className="rounded-xl bg-white shadow-soft p-6 space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-navy-900">{selectedSite.domain}</h2>
                  <p className="text-sm text-navy-400">
                    {selectedSite.profiles.company_name ?? selectedSite.profiles.full_name ?? 'Unknown owner'}
                  </p>
                </div>

                {message && (
                  <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    message.type === 'success'
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {message.text}
                  </div>
                )}

                {/* Tracking mode */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-2">
                    Tracking mode
                  </label>
                  <div className="flex gap-3">
                    {(['snapshot', 'full'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setTrackingMode(mode)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                          trackingMode === mode
                            ? 'bg-navy-900 text-white'
                            : 'border border-navy-200 text-navy-700 hover:bg-navy-50'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-navy-400">
                    {trackingMode === 'snapshot'
                      ? 'Stores daily score and new review count only.'
                      : 'Stores every individual review — reviewer name, rating, and text.'}
                  </p>
                </div>

                {/* Google Places */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-2">
                    Google Place
                  </label>

                  {(selectedPlace || selectedSite.google_place_id) && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2">
                      <CheckCircle className="h-4 w-4 text-brand-600 shrink-0" />
                      <p className="text-sm text-brand-800 font-medium">
                        {selectedPlace
                          ? `${selectedPlace.name} — ${selectedPlace.address}`
                          : `Place ID: ${selectedSite.google_place_id}`}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search business name..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="flex-1 rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching || !searchQuery.trim()}
                      className="rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {searching
                        ? <RefreshCw className="h-4 w-4 animate-spin" />
                        : <Search className="h-4 w-4" />
                      }
                      Search
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <ul className="mt-2 rounded-lg border border-navy-200 divide-y divide-navy-50 overflow-hidden">
                      {searchResults.map(place => (
                        <li key={place.placeId}>
                          <button
                            onClick={() => { setSelectedPlace(place); setSearchResults([]) }}
                            className="w-full text-left px-4 py-3 hover:bg-navy-50 transition-colors"
                          >
                            <p className="text-sm font-medium text-navy-900">{place.name}</p>
                            <p className="text-xs text-navy-400">{place.address}</p>
                            {place.rating && (
                              <p className="text-xs text-navy-500 mt-0.5">
                                ★ {place.rating} · {place.totalReviews?.toLocaleString()} reviews
                              </p>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Trustpilot */}
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-2">
                    Trustpilot Domain
                  </label>
                  <input
                    type="text"
                    placeholder="example.co.uk"
                    value={trustpilotInput}
                    onChange={e => setTrustpilotInput(e.target.value)}
                    className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                  />
                  <p className="mt-1 text-xs text-navy-400">
                    Enter the domain exactly as it appears on Trustpilot (e.g. wolds-digital.co.uk)
                  </p>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
                  Save Configuration
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
