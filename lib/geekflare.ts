import 'server-only'

import type {
  BrokenLink,
  BrokenLinksResult,
} from '@/lib/integrations/broken-links'

/**
 * Geekflare API client — Broken Links only.
 *
 * The Geekflare broken-link API response shape changed in 2025:
 *   old: { result: [{ link, statusCode, error, foundOn }] }
 *   new: { data:   [{ link, status }] }
 * Both shapes are handled so any cached re-runs don't error.
 */

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

/* ─────────────────────────────── Broken Links ────────────────────────────── */

interface GeekflareLinkRow {
  link?:       string
  status?:     number
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
