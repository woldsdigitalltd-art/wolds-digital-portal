import 'server-only'

/**
 * Better Stack (Uptime) API v2 client.
 * Docs: https://betterstack.com/docs/uptime/api/
 *
 * The API key is always passed in by the caller (read from
 * `integrations.input_values.api_key` server-side). This module never
 * touches env vars or the DB.
 */

const API = 'https://uptime.betterstack.com/api/v2'

type Json = Record<string, unknown>

async function request(
  apiKey: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path:   string,
  body?:  Json,
): Promise<Json | null> {
  const res = await fetch(`${API}${path}`, {
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
      `Better Stack ${method} ${path} [${res.status}]: ${JSON.stringify(json)}`,
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
