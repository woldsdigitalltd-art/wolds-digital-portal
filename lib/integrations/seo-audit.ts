/**
 * Shared SEO audit types + pure helpers.
 *
 * Lives outside `server-only` so the admin UI (client component) and
 * the portal SEO page (server component) can both render an audit
 * report. The provider call itself lives in `@/lib/seoscoreapi`.
 */

export type CheckStatus = 'pass' | 'warning' | 'fail'

export interface CheckResult {
  status:      CheckStatus
  score:       number
  description: string
  fix?:        string
}

export interface SeoAuditPriority {
  issue:  string
  impact: string
  fix:    string
}

export interface SeoAuditChecks {
  meta_content: {
    title_length:      CheckResult
    meta_description:  CheckResult
    h1_count:          CheckResult
    heading_hierarchy: CheckResult
    content_length:    CheckResult
    readability:       CheckResult
    image_alt_text:    CheckResult
    link_ratio:        CheckResult
  }
  technical: {
    response_time:   CheckResult
    https:           CheckResult
    ssl:             CheckResult
    status_code:     CheckResult
    canonical:       CheckResult
    viewport:        CheckResult
    robots_meta:     CheckResult
    structured_data: CheckResult
    robots_txt:      CheckResult
    sitemap:         CheckResult
  }
  social: {
    open_graph:   CheckResult
    twitter_card: CheckResult
    favicon:      CheckResult
  }
  performance: {
    html_size:       CheckResult
    dom_complexity:  CheckResult
    compression:     CheckResult
    render_blocking: CheckResult
  }
  accessibility: {
    lang_attribute: CheckResult
    image_alt:      CheckResult
    aria_landmarks: CheckResult
  }
  ai_readability: Record<string, CheckResult>
  sxo_aeo_aio:    Record<string, CheckResult>
}

export interface SeoAuditResult {
  url:        string
  /** Overall 0–100 score. */
  score:      number
  /** Grade letter — typically one of A/B/C/D/F. */
  grade:      string
  priorities: SeoAuditPriority[]
  checks:     SeoAuditChecks
  /** ISO timestamp stamped server-side before persistence. */
  audited_at: string
}

/* ─────────────────────────────── Helpers ──────────────────────────────── */

export interface CategoryCounts {
  pass:    number
  warning: number
  fail:    number
  total:   number
}

/** Reduce a category bucket of checks down to pass/warning/fail counts. */
export function countCategory(
  checks: Record<string, CheckResult | undefined> | undefined | null,
): CategoryCounts {
  const counts: CategoryCounts = { pass: 0, warning: 0, fail: 0, total: 0 }
  if (!checks) return counts
  for (const check of Object.values(checks)) {
    if (!check || typeof check !== 'object') continue
    counts.total++
    if (check.status === 'pass')         counts.pass++
    else if (check.status === 'warning') counts.warning++
    else if (check.status === 'fail')    counts.fail++
  }
  return counts
}

/** Tailwind classes for an overall 0–100 score. */
export function scoreColour(score: number): {
  text: string
  bg:   string
  ring: string
} {
  if (score >= 80) return { text: 'text-brand-700', bg: 'bg-brand-50',  ring: 'ring-brand-100' }
  if (score >= 60) return { text: 'text-amber-700', bg: 'bg-amber-50',  ring: 'ring-amber-200' }
  return                  { text: 'text-red-700',   bg: 'bg-red-50',    ring: 'ring-red-200'   }
}

/** Category descriptors used by both admin + portal report views. */
export const SEO_CATEGORIES = [
  { key: 'meta_content',   label: 'Meta & Content' },
  { key: 'technical',      label: 'Technical SEO'  },
  { key: 'social',         label: 'Social'         },
  { key: 'performance',    label: 'Performance'    },
  { key: 'accessibility',  label: 'Accessibility'  },
  { key: 'ai_readability', label: 'AI Readability' },
] as const

export type SeoCategoryKey = (typeof SEO_CATEGORIES)[number]['key']

/** Pull category counts in the canonical order used in the UI. */
export function categoryBreakdown(audit: SeoAuditResult): Array<{
  key:    SeoCategoryKey
  label:  string
  counts: CategoryCounts
}> {
  // `audit.checks` is typed as required but in practice the SEO Score
  // API may return partial payloads (e.g. when the audit errors or
  // older rows persisted before a shape change). Defensive: treat any
  // missing/non-object value as an empty bucket so the UI still renders.
  const rawChecks: unknown = (audit as { checks?: unknown })?.checks
  const checks =
    rawChecks && typeof rawChecks === 'object'
      ? (rawChecks as Record<string, unknown>)
      : {}

  return SEO_CATEGORIES.map(({ key, label }) => {
    const bucket = checks[key] as Record<string, CheckResult> | undefined
    return { key, label, counts: countCategory(bucket) }
  })
}
