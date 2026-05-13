import 'server-only'

/**
 * Better Stack (Uptime) API v2 client.
 * Docs: https://betterstack.com/docs/uptime/api/
 *
 * The API key is always passed in by the caller (read from
 * `integrations.input_values.api_key` server-side). This module never
 * touches env vars or the DB.
 */

const API_ROOT = 'https://uptime.betterstack.com/api'

type Json = Record<string, unknown>

async function request(
  apiKey:  string,
  method:  'GET' | 'POST' | 'PUT' | 'DELETE',
  path:    string,
  body?:   Json,
  version: 'v2' | 'v3' = 'v2',
): Promise<Json | null> {
  const res = await fetch(`${API_ROOT}/${version}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  let json: Json
  try {
    json = (await res.json()) as Json
  } catch {
    json = {}
  }

  if (!res.ok) {
    throw new Error(
      `Better Stack ${method} /${version}${path} [${res.status}]: ${JSON.stringify(json)}`,
    )
  }
  return json
}

export interface CreatedMonitor {
  monitor_id: string
  metadata:   Record<string, unknown>
}

/** Create an HTTP "status" monitor for the given URL. */
export async function createMonitor(
  apiKey: string,
  url:    string,
  name:   string,
): Promise<CreatedMonitor> {
  const data = await request(apiKey, 'POST', '/monitors', {
    monitor_type:       'status',
    url,
    pronounceable_name: name,
    check_frequency:    60,
  })
  const node = (data as { data?: { id: unknown; attributes: Json } } | null)?.data
  if (!node) throw new Error('Better Stack returned an empty response body.')
  return {
    monitor_id: String(node.id),
    metadata:   node.attributes,
  }
}

/** Permanently delete a monitor. Idempotent against 404s. */
export async function deleteMonitor(apiKey: string, monitorId: string): Promise<void> {
  try {
    await request(apiKey, 'DELETE', `/monitors/${monitorId}`)
  } catch (err) {
    if (err instanceof Error && /\[404\]/.test(err.message)) return
    throw err
  }
}

/** Read the live attributes for a single monitor. */
export async function getMonitor(
  apiKey:    string,
  monitorId: string,
): Promise<Record<string, unknown>> {
  const data  = await request(apiKey, 'GET', `/monitors/${monitorId}`)
  const attrs = (data as { data?: { attributes: Json } } | null)?.data?.attributes
  return attrs ?? {}
}

export interface MonitorIncident {
  started_at:  string         // ISO timestamp
  resolved_at: string | null  // ISO timestamp, null if still open
}

/**
 * List every incident for `monitorId` between `from` and `to`
 * (YYYY-MM-DD, inclusive of `from`, exclusive of `to`). Handles
 * pagination automatically. Each row exposes only the two timestamps
 * needed to compute downtime overlap with arbitrary time buckets.
 *
 * Uses Better Stack's v3 incidents endpoint — one call (plus paging)
 * for the entire range, replacing N parallel SLA calls.
 */
export async function getMonitorIncidents(
  apiKey:    string,
  monitorId: string,
  from:      string,
  to:        string,
): Promise<MonitorIncident[]> {
  const out: MonitorIncident[] = []
  let page = 1
  const perPage = 50

  // Hard cap on pages so a runaway response can't loop us forever.
  // 50 incidents/page × 20 = 1000 incidents per range is plenty.
  for (let i = 0; i < 20; i++) {
    const path =
      `/incidents` +
      `?monitor_id=${encodeURIComponent(monitorId)}` +
      `&from=${encodeURIComponent(from)}` +
      `&to=${encodeURIComponent(to)}` +
      `&per_page=${perPage}&page=${page}`

    const data = await request(apiKey, 'GET', path, undefined, 'v3')
    const rows = (data as { data?: Array<{ attributes?: Json }> } | null)?.data ?? []

    for (const row of rows) {
      const a = row.attributes ?? {}
      const started_at  = typeof a.started_at  === 'string' ? a.started_at  : null
      const resolved_at = typeof a.resolved_at === 'string' ? a.resolved_at : null
      if (!started_at) continue
      out.push({ started_at, resolved_at })
    }

    if (rows.length < perPage) break
    page += 1
  }

  return out
}
