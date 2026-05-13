import 'server-only'

import type {
  CoreWebVital,
  CoreWebVitalStatus,
  PageSpeedOpportunity,
  PageSpeedResult,
} from '@/lib/integrations/page-speed'
import type {
  BrokenLink,
  BrokenLinksResult,
} from '@/lib/integrations/broken-links'

/**
 * Geekflare API client (api.geekflare.com).
 *
 * One API key (stored on each integration's `input_values.api_key`)
 * covers both the Lighthouse-backed Page Speed audit and the broken
 * link scanner. Each provisioned site_integration stores the most
 * recent audit JSON on `provider_metadata`.
 */

const API = 'https://api.geekflare.com'

interface Json {
  [key: string]: unknown
}

async function request(
  apiKey:   string,
  endpoint: string,
  body:     Record<string, unknown>,
): Promise<Json> {
  if (!apiKey) throw new Error('Geekflare API key is missing.')

  const res = await fetch(`${API}/${endpoint}`, {
    method:  'POST',
    headers: {
      'x-api-key':    apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let json: Json
  try {
    json = (await res.json()) as Json
  } catch {
    json = {}
  }

  if (!res.ok) {
    throw new Error(
      `Geekflare ${endpoint} [${res.status}]: ${JSON.stringify(json)}`,
    )
  }
  return json
}

/* ─────────────────────────────── Page Speed ──────────────────────────── */

interface LighthouseAudit {
  id?:           string
  title?:        string
  description?:  string
  numericValue?: number
  score?:        number | null
  details?:      { type?: string; overallSavingsMs?: number }
}

interface LighthouseResult {
  categories?: Record<string, { score?: number }>
  audits?:     Record<string, LighthouseAudit>
}

/**
 * Run a Lighthouse audit against `url` (desktop strategy) and reshape
 * the result down to what the UI actually renders. We deliberately
 * throw away most of the verbose Lighthouse payload — the audit is
 * stored in Postgres and we don't want a 1MB+ JSON blob per site.
 */
export async function runPageSpeedAudit(
  apiKey: string,
  url:    string,
): Promise<PageSpeedResult> {
  const data   = await request(apiKey, 'lighthouse', { url, type: 'desktop' })
  const result = (data.result as LighthouseResult | undefined) ?? {}

  const cats = result.categories ?? {}
  const audits = result.audits   ?? {}

  return {
    url,
    scores: {
      performance:    score100(cats.performance?.score),
      accessibility:  score100(cats.accessibility?.score),
      seo:            score100(cats.seo?.score),
      best_practices: score100(cats['best-practices']?.score),
    },
    core_web_vitals: {
      lcp: vitalFromAudit(audits['largest-contentful-paint'], 'ms'),
      cls: vitalFromAudit(audits['cumulative-layout-shift'],  ''),
      fid: vitalFromAudit(audits['total-blocking-time'],      'ms'),
    },
    opportunities: collectOpportunities(audits),
    audited_at:    new Date().toISOString(),
  }
}

function score100(score: number | null | undefined): number {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 0
  return Math.round(score * 100)
}

function vitalStatus(score: number | null | undefined): CoreWebVitalStatus {
  if (typeof score !== 'number') return 'fail'
  if (score >= 0.9)              return 'pass'
  if (score >= 0.5)              return 'needs-improvement'
  return                              'fail'
}

function vitalFromAudit(
  audit: LighthouseAudit | undefined,
  unit:  string,
): CoreWebVital {
  return {
    value:  typeof audit?.numericValue === 'number' ? audit.numericValue : 0,
    unit,
    status: vitalStatus(audit?.score ?? null),
  }
}

function collectOpportunities(
  audits: Record<string, LighthouseAudit>,
): PageSpeedOpportunity[] {
  return Object.values(audits)
    .filter(a =>
      a.details?.type === 'opportunity' &&
      typeof a.score === 'number' &&
      a.score < 1,
    )
    .slice(0, 5)
    .map<PageSpeedOpportunity>(a => ({
      id:          a.id          ?? '',
      title:       a.title       ?? '',
      description: a.description ?? '',
      savings_ms:  a.details?.overallSavingsMs,
    }))
}

/* ─────────────────────────────── Broken Links ────────────────────────── */

interface GeekflareLinkRow {
  link?:       string
  statusCode?: number
  error?:      string
  foundOn?:    string
}

/**
 * Scan `url` for broken links. Returns a compact summary (totals) plus
 * up to 50 broken-link rows. Warnings (3xx) are counted in the summary
 * but not enumerated.
 */
export async function runBrokenLinksAudit(
  apiKey: string,
  url:    string,
): Promise<BrokenLinksResult> {
  const data = await request(apiKey, 'broken-link', { url })
  const rows = Array.isArray(data.result) ? (data.result as GeekflareLinkRow[]) : []

  const broken  = rows.filter(l => isBroken(l.statusCode))
  const warning = rows.filter(l => isWarning(l.statusCode))

  return {
    url,
    total_links: rows.length,
    broken:      broken.length,
    warnings:    warning.length,
    broken_links: broken.slice(0, 50).map<BrokenLink>(l => ({
      link:        l.link       ?? '',
      status_code: typeof l.statusCode === 'number' ? l.statusCode : 0,
      error:       l.error      ?? `HTTP ${l.statusCode ?? '???'}`,
      found_on:    l.foundOn    ?? url,
    })),
    audited_at: new Date().toISOString(),
  }
}

function isBroken(code: number | undefined): boolean {
  if (typeof code !== 'number') return true
  return code >= 400 || code === 0
}

function isWarning(code: number | undefined): boolean {
  return typeof code === 'number' && code >= 300 && code < 400
}
