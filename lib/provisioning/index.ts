import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  provisionUptimeMonitor,
  provisionSSLMonitor,
  deprovisionUptimeMonitor,
  deprovisionSSLMonitor,
} from './providers/betterstack'

/**
 * Provisioning orchestrator.
 *
 * Routes a `site_services` row to the right external provider based
 * on its `service.key`, and keeps the row's `status` /
 * `provider_resource_id` / `last_error` columns in sync.
 *
 * Reads platform-level credentials (e.g. our own Better Stack API
 * key) from `services.global_settings_data`, which is only readable
 * via the service role — never via the normal user session.
 */

export type ProvisionResult =
  | { status: 'active'; provider_resource_id: string; metadata: Record<string, unknown> }
  | { status: 'active'; provider_resource_id: null }

interface JoinedSite { domain: string; display_name: string | null }
interface JoinedService {
  key:                     string
  provisioning_required:   boolean
  global_settings_data:    Record<string, unknown> | null
}

/* ──────────────────────────────────────────── provision ─────────────────────────────── */

export async function provisionSiteService(
  siteServiceId: string,
): Promise<ProvisionResult> {
  const supabase = createServiceRoleClient()

  const { data: ss, error } = await supabase
    .from('site_services')
    .select(`
      id,
      credentials,
      status,
      service:services (
        key,
        provisioning_required,
        global_settings_data
      ),
      site:sites (
        domain,
        display_name
      ),
      auth_type:service_auth_types (
        auth_type,
        label
      )
    `)
    .eq('id', siteServiceId)
    .single()

  if (error || !ss) {
    throw new Error(`site_service not found: ${siteServiceId}`)
  }

  const service = ss.service  as unknown as JoinedService | null
  const site    = ss.site     as unknown as JoinedSite    | null
  const creds   = (ss.credentials ?? {}) as Record<string, unknown>

  if (!service) throw new Error('site_service is not linked to a service row.')
  if (!site)    throw new Error('site_service is not linked to a site.')

  // Non-provisioning services (analytics, whats_on manual etc.) → mark active.
  if (!service.provisioning_required) {
    await supabase
      .from('site_services')
      .update({
        status:         'active',
        provisioned_at: new Date().toISOString(),
        last_error:     null,
      })
      .eq('id', siteServiceId)

    return { status: 'active', provider_resource_id: null }
  }

  // Optimistic mid-flight status so the UI can show "provisioning".
  await supabase
    .from('site_services')
    .update({ status: 'provisioning' })
    .eq('id', siteServiceId)

  try {
    const globalSettings = (service.global_settings_data ?? {}) as Record<string, unknown>
    let result: { monitor_id: string; metadata: Record<string, unknown> }

    switch (service.key) {
      case 'uptime': {
        const apiKey = globalSettings.api_key as string | undefined
        if (!apiKey) {
          throw new Error('Better Stack API key not configured in service global settings.')
        }
        const url = creds.url as string | undefined
        if (!url) throw new Error('URL to monitor is required in credentials.')

        result = await provisionUptimeMonitor({
          apiKey,
          url,
          name:           site.display_name?.trim() || site.domain,
          checkFrequency: Number(creds.check_frequency ?? 60),
          alertEmail:     (creds.alert_email as string | undefined) ?? undefined,
        })
        break
      }

      case 'ssl': {
        const apiKey = globalSettings.api_key as string | undefined
        if (!apiKey) {
          throw new Error('Better Stack API key not configured in service global settings.')
        }
        const domain = (creds.domain as string | undefined) ?? site.domain
        if (!domain) throw new Error('Domain is required for SSL monitoring.')

        result = await provisionSSLMonitor({
          apiKey,
          domain,
          name:            site.display_name?.trim() || site.domain,
          alertDaysBefore: Number(creds.alert_days_before ?? 30),
        })
        break
      }

      default:
        throw new Error(
          `No provisioner implemented for service key "${service.key}". ` +
          `Add a case to lib/provisioning/index.ts.`,
        )
    }

    await supabase
      .from('site_services')
      .update({
        status:               'active',
        provider_resource_id: result.monitor_id,
        provider_metadata:    result.metadata,
        provisioned_at:       new Date().toISOString(),
        last_error:           null,
      })
      .eq('id', siteServiceId)

    return {
      status:               'active',
      provider_resource_id: result.monitor_id,
      metadata:             result.metadata,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase
      .from('site_services')
      .update({
        status:     'error',
        last_error: message,
      })
      .eq('id', siteServiceId)
    throw err
  }
}

/* ─────────────────────────────────────────── deprovision ────────────────────────────── */

export async function deprovisionSiteService(siteServiceId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  const { data: ss, error } = await supabase
    .from('site_services')
    .select(`
      id,
      provider_resource_id,
      service:services (
        key,
        global_settings_data
      )
    `)
    .eq('id', siteServiceId)
    .single()

  if (error || !ss) throw new Error(`site_service not found: ${siteServiceId}`)

  const service = ss.service as unknown as JoinedService | null
  if (!service) throw new Error('site_service is not linked to a service row.')

  const globalSettings = (service.global_settings_data ?? {}) as Record<string, unknown>
  const apiKey         = globalSettings.api_key as string | undefined
  const providerResId  = ss.provider_resource_id as string | null

  // Nothing external to remove — just mark cancelled.
  if (!providerResId) {
    await supabase
      .from('site_services')
      .update({ status: 'cancelled', last_error: null })
      .eq('id', siteServiceId)
    return
  }

  try {
    switch (service.key) {
      case 'uptime':
        if (!apiKey) throw new Error('Better Stack API key not configured.')
        await deprovisionUptimeMonitor({ apiKey, monitorId: providerResId })
        break
      case 'ssl':
        if (!apiKey) throw new Error('Better Stack API key not configured.')
        await deprovisionSSLMonitor({ apiKey, monitorId: providerResId })
        break
      default:
        // No external resource to clean up — just mark cancelled.
        break
    }

    await supabase
      .from('site_services')
      .update({ status: 'cancelled', last_error: null })
      .eq('id', siteServiceId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase
      .from('site_services')
      .update({
        status:     'error',
        last_error: `Deprovision failed: ${message}`,
      })
      .eq('id', siteServiceId)
    throw err
  }
}
