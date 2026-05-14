import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { IncidentInput, AlertInput } from './types'

/**
 * Raise an incident for a given (site_id, rule_key) pair.
 *
 * Dedup logic:
 *   open      → skip (already active)
 *   dismissed → skip (customer/admin has acknowledged and won't act)
 *   resolved  → raise fresh (problem came back)
 *   no row    → raise
 */
export async function raiseIncident(input: IncidentInput): Promise<void> {
  const sr = createServiceRoleClient()

  const { data: existing } = await sr
    .from('incidents')
    .select('id, status')
    .eq('site_id', input.site_id)
    .eq('rule_key', input.rule_key)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.status === 'open' || existing?.status === 'dismissed') return

  const { error } = await sr.from('incidents').insert({
    site_id:         input.site_id,
    integration_key: input.integration_key,
    rule_key:        input.rule_key,
    title:           input.title,
    description:     input.description,
    severity:        input.severity,
  })

  if (error) {
    console.error(`raiseIncident [${input.rule_key}]:`, error)
  }
}

/**
 * Raise a transient alert for a given (site_id, rule_key) pair.
 * If an open alert already exists, skip (idempotent).
 */
export async function raiseAlert(input: AlertInput): Promise<void> {
  const sr = createServiceRoleClient()

  const { data: existing } = await sr
    .from('alerts')
    .select('id, status')
    .eq('site_id', input.site_id)
    .eq('rule_key', input.rule_key)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) return

  const { error } = await sr.from('alerts').insert({
    site_id:         input.site_id,
    integration_key: input.integration_key,
    rule_key:        input.rule_key,
    title:           input.title,
    description:     input.description ?? null,
    severity:        input.severity,
  })

  if (error) {
    console.error(`raiseAlert [${input.rule_key}]:`, error)
  }
}
