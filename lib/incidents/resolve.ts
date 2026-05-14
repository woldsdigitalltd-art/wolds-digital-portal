import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function resolveIncident(
  incidentId: string,
  resolvedBy: string,
  note?: string,
): Promise<void> {
  const sr = createServiceRoleClient()
  const { error } = await sr
    .from('incidents')
    .update({
      status:      'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      ...(note ? { dismiss_reason: note } : {}),
    })
    .eq('id', incidentId)

  if (error) console.error(`resolveIncident [${incidentId}]:`, error)
}

export async function dismissIncident(
  incidentId:    string,
  resolvedBy:    string,
  dismissReason: string,
): Promise<void> {
  const sr = createServiceRoleClient()
  const { error } = await sr
    .from('incidents')
    .update({
      status:         'dismissed',
      resolved_at:    new Date().toISOString(),
      resolved_by:    resolvedBy,
      dismiss_reason: dismissReason,
    })
    .eq('id', incidentId)

  if (error) console.error(`dismissIncident [${incidentId}]:`, error)
}

export async function reopenIncident(incidentId: string): Promise<void> {
  const sr = createServiceRoleClient()
  const { error } = await sr
    .from('incidents')
    .update({
      status:         'open',
      resolved_at:    null,
      resolved_by:    null,
      dismiss_reason: null,
    })
    .eq('id', incidentId)

  if (error) console.error(`reopenIncident [${incidentId}]:`, error)
}

/**
 * Auto-resolve an open alert when the triggering condition clears.
 * Matches on (site_id, rule_key) — resolves the most recent open row.
 */
export async function resolveAlert(siteId: string, ruleKey: string): Promise<void> {
  const sr = createServiceRoleClient()
  const { error } = await sr
    .from('alerts')
    .update({
      status:      'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('site_id', siteId)
    .eq('rule_key', ruleKey)
    .eq('status', 'open')

  if (error) console.error(`resolveAlert [${ruleKey}]:`, error)
}
