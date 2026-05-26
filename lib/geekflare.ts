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
 * Audit clients for the two Geekflare-backed integrations.
 *
 * ── Page Speed ──────────────────────────────────────────────────────────────
 * The Geekflare Lighthouse endpoint migrated to returning an HTML report URL
 * rather than structured JSON. We now use the Google PageSpeed Insights API
 * (v5) instead — it runs the same Lighthouse engine, returns clean JSON,
 * and is free without an API key. The Geekflare API key stored on the
 * integration is accepted but silently ignored (it keeps the DB row valid
 * so no migration of existing site_integrations is needed).
 *
 * ── Broken Links ────────────────────────────────────────────────────────────
 * The Geekflare broken-link API response moved from
 *   { result: [{ link, statusCode, error, foundOn }] }
 * to
 *   { data: [{ link, status }] }
 * Both shapes are handled so any cached re-runs don't error.
 */

/* ─────────────────────────────── Page Speed ──────────────────────────────── */

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
 * Run a Lighthouse audit via Google PageSpeed Insights (v5).
 *
 * The `apiKey` parameter is accepted for interface compatibility with the
 * existing Geekflare integration row but is **not used** — Google PSI works
 * without a key for normal audit volumes. If you ever want to supply a Google
 * API key you can pass it here; non-Geekflare keys (i.e. not prefixed `gf_`)
 * are forwarded as the `key` query parameter.
 */
export async function runPageSpeedAudit(
  apiKey: string,
  url:    string,
): Promise<PageSpeedResult> {
  const endpoint = new URL(
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
  )
  endpoint.searchParams.set('url',      url)
  endpoint.searchParams.set('strategy', 'desktop')

  for (const cat of ['performance', 'accessibility', 'best-practices', 'seo']) {
    endpoint.searchParams.append('category', cat)
  }

  // Only forward as a Google API key if it doesn't look like a Geekflare key.
  if (apiKey && !apiKey.startsWith('gf_')) {
    endpoint.searchParams.set('key', apiKey)
  }

  const res = await fetch(endpoint.toString())

  let json: Record<string, unknown>
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    json = {}
  }

  if (!res.ok) {
    throw new Error(
      `Google PageSpeed Insights [${res.status}]: ${JSON.stringify(json)}`,
    )
  }

  const lhr    = (json.lighthouseResult as LighthouseResult | undefined) ?? {}
  const cats   = lhr.categories ?? {}
  const audits = lhr.audits     ?? {}

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

/* ─────────────────────────────── Broken Links ────────────────────────────── */

const GEEKFLARE_API = 'https://api.geekflare.com'

interface Json {
  [key: string]: unknown
}

async function geekflareRequest(
  apiKey:   string,
  endpoint: string,
  body:     Record<string, unknown>,
): Promise<Json> {
  if (!apiKey) throw new Error('Geekflare API key is missing.')

  const res = await fetch(`${GEEKFLARE_API}/${endpoint}`, {
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

/**
 * Geekflare link row — supports both old shape ({ statusCode, foundOn })
 * and the current shape ({ status }) so the client handles any lingering
 * cached responses gracefully.
 */
interface GeekflareLinkRow {
  link?:       string
  /** Current Geekflare API field name. */
  status?:     number
  /** Legacy field name kept for backward compat. */
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
  const data = await geekflareRequest(apiKey, 'brokenlink', { url })

  // Current API (≥ 2025): rows live under `data`
  // Legacy API:           rows lived under `result`
  const rows: GeekflareLinkRow[] =
    Array.isArray(data.data)   ? (data.data   as GeekflareLinkRow[]) :
    Array.isArray(data.result) ? (data.result as GeekflareLinkRow[]) : []

  const broken  = rows.filter(l => isBroken(l.status  ?? l.statusCode))
  const warning = rows.filter(l => isWarning(l.status ?? l.statusCode))

  return {
    url,
    total_links: rows.length,
    broken:      broken.length,
    warnings:    warning.length,
    broken_links: broken.slice(0, 50).map<BrokenLink>(l => {
      const code = l.status ?? l.statusCode
      return {
        link:        l.link    ?? '',
        status_code: typeof code === 'number' ? code : 0,
        error:       l.error   ?? `HTTP ${code ?? '???'}`,
        found_on:    l.foundOn ?? url,
      }
    }),
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
