/**
 * Shared Page Speed (Geekflare Lighthouse) audit types + pure helpers.
 *
 * Lives outside `server-only` so the admin modal (client component)
 * and the portal performance page (server component) can both render
 * the report. The provider call itself lives in `@/lib/geekflare`.
 */

export type CoreWebVitalStatus = 'pass' | 'needs-improvement' | 'fail'

export interface CoreWebVital {
  value:  number
  unit:   string
  status: CoreWebVitalStatus
}

export interface PageSpeedScores {
  performance:    number
  accessibility:  number
  seo:            number
  best_practices: number
}

export interface PageSpeedOpportunity {
  id:          string
  title:       string
  description: string
  savings_ms?: number
}

export interface PageSpeedResult {
  url:    string
  scores: PageSpeedScores
  core_web_vitals: {
    lcp: CoreWebVital
    cls: CoreWebVital
    fid: CoreWebVital
  }
  opportunities: PageSpeedOpportunity[]
  /** ISO timestamp stamped server-side before persistence. */
  audited_at: string
}

/* ─────────────────────────────── Helpers ──────────────────────────────── */

/** Tailwind classes for a 0–100 Lighthouse score. */
export function lighthouseColour(score: number): {
  text: string
  bg:   string
  ring: string
} {
  if (score >= 90) return { text: 'text-brand-700', bg: 'bg-brand-50',  ring: 'ring-brand-100' }
  if (score >= 50) return { text: 'text-amber-700', bg: 'bg-amber-50',  ring: 'ring-amber-200' }
  return                  { text: 'text-red-700',   bg: 'bg-red-50',    ring: 'ring-red-200'   }
}

/** Tailwind classes for a Core Web Vital status badge. */
export function vitalColour(status: CoreWebVitalStatus): {
  text:  string
  bg:    string
  ring:  string
  label: string
} {
  if (status === 'pass')              return { text: 'text-brand-700', bg: 'bg-brand-50', ring: 'ring-brand-100', label: 'Good' }
  if (status === 'needs-improvement') return { text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', label: 'Needs work' }
  return                                     { text: 'text-red-700',   bg: 'bg-red-50',   ring: 'ring-red-200',   label: 'Poor' }
}

/**
 * Format a Core Web Vital value for display. LCP/TBT are milliseconds
 * and we show seconds at >1000ms for readability; CLS is unitless and
 * truncates to 3 decimals.
 */
export function formatVital(v: CoreWebVital): string {
  if (v.unit === 'ms') {
    if (v.value >= 1000) return `${(v.value / 1000).toFixed(2)}s`
    return `${Math.round(v.value)}ms`
  }
  return v.value.toFixed(3)
}

export const SCORE_CATEGORIES: Array<{
  key:   keyof PageSpeedScores
  label: string
}> = [
  { key: 'performance',    label: 'Performance'    },
  { key: 'accessibility',  label: 'Accessibility'  },
  { key: 'seo',            label: 'SEO'            },
  { key: 'best_practices', label: 'Best Practices' },
]
