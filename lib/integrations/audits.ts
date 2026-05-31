import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runSeoAudit }           from '@/lib/seoscoreapi'
import { runBrokenLinksAudit }   from '@/lib/geekflare'
import type { SeoAuditResult }   from '@/lib/integrations/seo-audit'
import type { BrokenLinksResult } from '@/lib/integrations/broken-links'

/**
 * Audit-style integrations all share the same lifecycle:
 *
 *   1. The user attaches the integration to a site.
 *   2. We synchronously call the provider with the site's URL.
 *   3. We persist the JSON blob to `site_integrations.provider_metadata`.
 *   4. The portal renders that cached blob until the admin re-runs.
 */

export const AUDIT_INTEGRATION_KEYS = [
  'seoscoreapi',
  'brokenlinks',
] as const

export type AuditIntegrationKey = (typeof AUDIT_INTEGRATION_KEYS)[number]

export function isAuditIntegrationKey(key: string): key is AuditIntegrationKey {
  return (AUDIT_INTEGRATION_KEYS as readonly string[]).includes(key)
}

export type AuditPayload =
  | { key: 'seoscoreapi'; result: SeoAuditResult    }
  | { key: 'brokenlinks'; result: BrokenLinksResult }

export async function runAuditForKey(
  key:    AuditIntegrationKey,
  apiKey: string,
  url:    string,
): Promise<AuditPayload> {
  switch (key) {
    case 'seoscoreapi':
      return { key, result: await runSeoAudit(apiKey, url) }
    case 'brokenlinks':
      return { key, result: await runBrokenLinksAudit(apiKey, url) }
  }
}

/* ───────────────────── Per-site metadata fetchers ─────────────────────── */

interface AuditRow {
  site_id:           string
  provider_metadata: unknown
  integration: {
    key: string
  } | null
}

async function loadAuditMap<T>(
  siteIds:         string[],
  expectedKey:     string,
  validatePayload: (value: unknown) => value is T,
  diagnosticTag:   string,
): Promise<Map<string, T>> {
  const map = new Map<string, T>()
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
    console.error(`${diagnosticTag}: load failed:`, error)
    return map
  }

  const rows = (data ?? []) as unknown as AuditRow[]
  for (const row of rows) {
    if (row.integration?.key !== expectedKey)  continue
    if (!validatePayload(row.provider_metadata)) continue
    map.set(row.site_id, row.provider_metadata)
  }
  return map
}

/* ─ Broken Links ──────────────────────────────────────────────────────── */

export function fetchBrokenLinksBySite(
  siteIds: string[],
): Promise<Map<string, BrokenLinksResult>> {
  return loadAuditMap<BrokenLinksResult>(
    siteIds,
    'brokenlinks',
    isBrokenLinksPayload,
    'fetchBrokenLinksBySite',
  )
}

function isBrokenLinksPayload(value: unknown): value is BrokenLinksResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.url === 'string' &&
    typeof v.total_links === 'number' &&
    typeof v.broken === 'number' &&
    typeof v.audited_at === 'string' &&
    Array.isArray(v.broken_links)
  )
}
