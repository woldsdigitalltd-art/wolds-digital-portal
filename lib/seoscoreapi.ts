import 'server-only'

import type { SeoAuditResult } from '@/lib/integrations/seo-audit'

/**
 * SEO Score (seoscoreapi.com) API client.
 *
 * The API key is always passed in by the caller (read from
 * `integrations.input_values.api_key` server-side). This module never
 * touches env vars or the DB.
 */

const API = 'https://seoscoreapi.com'

/**
 * Run a fresh audit for a single URL. Throws on any non-2xx response;
 * callers are responsible for converting that into a user-facing error
 * and recording it on the `site_integrations` row.
 */
export async function runSeoAudit(
  apiKey: string,
  url:    string,
): Promise<SeoAuditResult> {
  if (!apiKey) throw new Error('SEO Score API key is missing.')

  const res = await fetch(
    `${API}/audit?url=${encodeURIComponent(url)}`,
    {
      method:  'GET',
      headers: { 'X-API-Key': apiKey },
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `SEO Score API [${res.status}]${text ? `: ${text}` : ''}`,
    )
  }

  const data = (await res.json()) as Omit<SeoAuditResult, 'audited_at'>
  return { ...data, audited_at: new Date().toISOString() }
}
