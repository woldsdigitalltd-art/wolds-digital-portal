/**
 * Better Stack (Uptime) API v2 integration.
 * Docs: https://betterstack.com/docs/uptime/api/
 *
 * Each function takes the Wolds Digital platform API key explicitly
 * so this module never has to read env vars or DB rows itself — the
 * orchestrator in `lib/provisioning/index.ts` handles that.
 */
const BETTERSTACK_API = 'https://uptime.betterstack.com/api/v2'

export interface BetterStackMonitor {
  monitor_id: string
  metadata:   Record<string, unknown>
}

type Json = Record<string, unknown>

/** Internal helper: makes a JSON request and throws on non-2xx. */
async function bsRequest(
  apiKey: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path:   string,
  body?:  Json,
): Promise<Json | null> {
  const res = await fetch(`${BETTERSTACK_API}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Better Stack ${method} ${path} failed [${res.status}]: ${text}`,
    )
  }

  // DELETE returns 204 no content
  if (res.status === 204) return null
  return (await res.json()) as Json
}

/* ────────────────────────────────────────── Uptime monitor ──────────────────────────── */

export async function provisionUptimeMonitor({
  apiKey,
  url,
  name,
  checkFrequency = 60,
  alertEmail,
}: {
  apiKey:          string
  url:             string
  name:            string
  checkFrequency?: number
  alertEmail?:     string
}): Promise<BetterStackMonitor> {
  const body: Json = {
    monitor_type:       'status',
    url,
    pronounceable_name: name,
    check_frequency:    checkFrequency,
  }
  if (alertEmail) body.email = alertEmail

  const data = await bsRequest(apiKey, 'POST', '/monitors', body)
  const node = (data as { data?: { id: unknown; attributes: Json } } | null)?.data
  if (!node) throw new Error('Better Stack returned an empty response body.')

  return {
    monitor_id: String(node.id),
    metadata:   node.attributes,
  }
}

export async function deprovisionUptimeMonitor({
  apiKey,
  monitorId,
}: {
  apiKey:    string
  monitorId: string
}): Promise<void> {
  await bsRequest(apiKey, 'DELETE', `/monitors/${monitorId}`)
}

export async function getUptimeMonitorStatus({
  apiKey,
  monitorId,
}: {
  apiKey:    string
  monitorId: string
}): Promise<{
  status:            'up' | 'down' | 'paused' | string
  uptime_percentage: number | null
  last_checked_at:   string | null
}> {
  const data = await bsRequest(apiKey, 'GET', `/monitors/${monitorId}`)
  const attrs = (data as { data?: { attributes: Json } } | null)?.data?.attributes ?? {}

  return {
    status:            (attrs.status as string) ?? 'unknown',
    uptime_percentage: (attrs.availability as number | null) ?? null,
    last_checked_at:   (attrs.last_checked_at as string | null) ?? null,
  }
}

/* ──────────────────────────────────────────── SSL monitor ───────────────────────────── */

export async function provisionSSLMonitor({
  apiKey,
  domain,
  name,
  alertDaysBefore = 30,
}: {
  apiKey:           string
  domain:           string
  name:             string
  alertDaysBefore?: number
}): Promise<BetterStackMonitor> {
  const body: Json = {
    monitor_type:       'ssl_certificate',
    url:                domain.startsWith('https://') ? domain : `https://${domain}`,
    pronounceable_name: `${name} — SSL`,
    domain_expiration:  alertDaysBefore,
  }

  const data = await bsRequest(apiKey, 'POST', '/monitors', body)
  const node = (data as { data?: { id: unknown; attributes: Json } } | null)?.data
  if (!node) throw new Error('Better Stack returned an empty response body.')

  return {
    monitor_id: String(node.id),
    metadata:   node.attributes,
  }
}

export async function deprovisionSSLMonitor({
  apiKey,
  monitorId,
}: {
  apiKey:    string
  monitorId: string
}): Promise<void> {
  await bsRequest(apiKey, 'DELETE', `/monitors/${monitorId}`)
}
