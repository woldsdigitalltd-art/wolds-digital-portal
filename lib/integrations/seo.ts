import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { SeoAuditResult } from '@/lib/integrations/seo-audit'

/**
 * Latest stored SEO Score audit per site.
 *
 * Unlike `fetchUptimeBySite`, which calls Better Stack live on every
 * render, the SEO audit is expensive and infrequent — we run it once
 * on attach (and on demand from the admin "Re-run audit" button) and
 * serve the cached JSON out of `site_integrations.provider_metadata`.
 *
 * Note: the equivalent helpers for the Geekflare integrations
 * (Page Speed, Broken Links) live in `./audits.ts` and follow the
 * same pattern. We keep the SEO one in its own module for backward
 * compatibility with existing imports.
 */

interface AuditRow {
  site_id:           string
  provider_metadata: unknown
  integration: {
    key: string
  } | null
}

/**
 * Returns a Map keyed by site_id with the latest SEO audit result for
 * any site in `siteIds` that has an active `seoscoreapi` integration.
 * Sites without an audit (or with a corrupt payload) are omitted.
 */
export async function fetchSeoAuditBySite(
  siteIds: string[],
): Promise<Map<string, SeoAuditResult>> {
  const map = new Map<string, SeoAuditResult>()
  if (siteIds.length === 0) return map

  const sr = createServiceRoleClient()
  const { data, error } = await sr
    .from('site_integrations')
    .select(`
      site_id, provider_metadata,
      integration:integrations ( key )
    `)
    .in('site_id', siteIds)
    .eq('status', 'active')

  if (error) {
    console.error('fetchSeoAuditBySite: load failed:', error)
    return map
  }

  const rows = (data ?? []) as unknown as AuditRow[]
  for (const row of rows) {
    if (row.integration?.key !== 'seoscoreapi') continue
    if (!isAuditPayload(row.provider_metadata)) continue
    map.set(row.site_id, row.provider_metadata)
  }
  return map
}

/**
 * Very loose runtime guard. The category breakdown helper is defensive
 * about a missing/malformed `checks` bucket, so we only require the
 * headline fields here — otherwise valid audits whose `checks` shape
 * drifts from the type slightly get filtered out and the page falsely
 * reports "audit pending".
 */
function isAuditPayload(value: unknown): value is SeoAuditResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.score === 'number' &&
    typeof v.grade === 'string' &&
    typeof v.audited_at === 'string'
  )
}
