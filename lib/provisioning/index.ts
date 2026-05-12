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
 * Routes a `site_integrations` row to the right external provider
 * based on its `integration.key`, and keeps the row's lifecycle
 * columns (`status`, `provider_resource_id`, `provider_metadata`,
 * `last_error`, `provisioned_at`) in sync.
 *
 * Reads platform-level credentials (e.g. our own Better Stack API
 * key) from `integrations.credentials`, which is only readable via
 * the service role — never via a normal user session.
 */

export type ProvisionResult =
  | { status: 'active'; provider_resource_id: string;  metadata: Record<string, unknown> }
  | { status: 'active'; provider_resource_id: null }

interface JoinedSite { domain: string; display_name: string | null }
interface JoinedIntegration {
  key:                   string
  provisioning_required: boolean
  credentials:           Record<string, unknown> | null
}

/* ──────────────────────────────────────────── provision ─────────────────────────────── */

export async function provisionSiteIntegration(
  siteIntegrationId: string,
): Promise<ProvisionResult> {
  const supabase = createServiceRoleClient()

  const { data: si, error } = await supabase
    .from('site_integrations')
    .select(`
      id,
      config,
      status,
      integration:integrations (
        key,
        provisioning_required,
        credentials
      ),
      site:sites (
        domain,
        display_name
      )
    `)
    .eq('id', siteIntegrationId)
    .single()

  if (error || !si) {
    throw new Error(`site_integration not found: ${siteIntegrationId}`)
  }

  const integration = si.integration as unknown as JoinedIntegration | null
  const site        = si.site        as unknown as JoinedSite | null
  const config      = (si.config ?? {}) as Record<string, unknown>

  if (!integration) throw new Error('site_integration is not linked to an integration row.')
  if (!site)        throw new Error('site_integration is not linked to a site.')

  // Non-provisioning integrations (analytics, whats_on) → mark active.
  if (!integration.provisioning_required) {
    await supabase
      .from('site_integrations')
      .update({
        status:         'active',
        provisioned_at: new Date().toISOString(),
        last_error:     null,
      })
      .eq('id', siteIntegrationId)

    return { status: 'active', provider_resource_id: null }
  }

  // Mid-flight status so the UI can show "provisioning…".
  await supabase
    .from('site_integrations')
    .update({ status: 'provisioning' })
    .eq('id', siteIntegrationId)

  try {
    const platformCreds = (integration.credentials ?? {}) as Record<string, unknown>
    let result: { monitor_id: string; metadata: Record<string, unknown> }

    switch (integration.key) {
      case 'uptime': {
        const apiKey = platformCreds.api_key as string | undefined
        if (!apiKey) {
          throw new Error('Better Stack API key not configured on the integration row.')
        }
        const url = `https://${site.domain}`

        result = await provisionUptimeMonitor({
          apiKey,
          url,
          name:           site.display_name?.trim() || site.domain,
          checkFrequency: Number(config.check_frequency ?? 60),
          alertEmail:     (config.alert_email as string | undefined) ?? undefined,
        })
        break
      }

      case 'ssl': {
        const apiKey = platformCreds.api_key as string | undefined
        if (!apiKey) {
          throw new Error('Better Stack API key not configured on the integration row.')
        }

        result = await provisionSSLMonitor({
          apiKey,
          domain:          site.domain,
          name:            site.display_name?.trim() || site.domain,
          alertDaysBefore: Number(config.alert_days_before ?? 30),
        })
        break
      }

      default:
        throw new Error(
          `No provisioner implemented for integration key "${integration.key}". ` +
          `Add a case to lib/provisioning/index.ts.`,
        )
    }

    await supabase
      .from('site_integrations')
      .update({
        status:               'active',
        provider_resource_id: result.monitor_id,
        provider_metadata:    result.metadata,
        provisioned_at:       new Date().toISOString(),
        last_error:           null,
      })
      .eq('id', siteIntegrationId)

    return {
      status:               'active',
      provider_resource_id: result.monitor_id,
      metadata:             result.metadata,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase
      .from('site_integrations')
      .update({
        status:     'error',
        last_error: message,
      })
      .eq('id', siteIntegrationId)
    throw err
  }
}

/* ─────────────────────────────────────────── deprovision ────────────────────────────── */

export async function deprovisionSiteIntegration(siteIntegrationId: string): Promise<void> {
  const supabase = createServiceRoleClient()

  const { data: si, error } = await supabase
    .from('site_integrations')
    .select(`
      id,
      provider_resource_id,
      integration:integrations (
        key,
        credentials
      )
    `)
    .eq('id', siteIntegrationId)
    .single()

  if (error || !si) throw new Error(`site_integration not found: ${siteIntegrationId}`)

  const integration = si.integration as unknown as JoinedIntegration | null
  if (!integration) throw new Error('site_integration is not linked to an integration row.')

  const platformCreds = (integration.credentials ?? {}) as Record<string, unknown>
  const apiKey        = platformCreds.api_key as string | undefined
  const providerResId = si.provider_resource_id as string | null

  if (!providerResId) {
    await supabase
      .from('site_integrations')
      .update({ status: 'cancelled', last_error: null })
      .eq('id', siteIntegrationId)
    return
  }

  try {
    switch (integration.key) {
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
      .from('site_integrations')
      .update({ status: 'cancelled', last_error: null })
      .eq('id', siteIntegrationId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase
      .from('site_integrations')
      .update({
        status:     'error',
        last_error: `Deprovision failed: ${message}`,
      })
      .eq('id', siteIntegrationId)
    throw err
  }
}
