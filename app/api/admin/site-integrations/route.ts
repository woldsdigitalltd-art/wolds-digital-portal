import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import { missingRequiredFields } from '@/lib/integrations/types'
import type { Integration, SiteIntegration } from '@/lib/integrations/types'
import { createMonitor } from '@/lib/betterstack'
import { isAuditIntegrationKey, runAuditForKey } from '@/lib/integrations/audits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Shape returned to the admin UI per row, with the joined integration
 * `key`/`name` flattened so badges + status copy don't have to drill
 * through nested objects.
 */
export interface SiteIntegrationListItem extends Omit<SiteIntegration, 'integration'> {
  integration_key:  string
  integration_name: string
}

interface RawRow extends Omit<SiteIntegration, 'integration'> {
  integration: { key: string; name: string } | null
}

function flatten(row: RawRow): SiteIntegrationListItem {
  const { integration: _drop, ...rest } = row
  void _drop
  return {
    ...rest,
    integration_key:  row.integration?.key  ?? '',
    integration_name: row.integration?.name ?? '',
  }
}

/**
 * GET /api/admin/site-integrations?site_id=…
 * List every integration linked to the given site.
 */
export async function GET(request: Request) {
  const guard = await requireApiAdmin()
  if (guard) return guard

  const siteId = new URL(request.url).searchParams.get('site_id')
  if (!siteId) {
    return NextResponse.json({ error: 'site_id is required.' }, { status: 400 })
  }

  const sr = createServiceRoleClient()
  const { data, error } = await sr
    .from('site_integrations')
    .select(`
      id, site_id, integration_id, status,
      provider_resource_id, provider_metadata,
      input_values,
      last_error, provisioned_at,
      created_at, updated_at,
      integration:integrations ( key, name )
    `)
    .eq('site_id', siteId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('list site integrations failed:', error)
    return NextResponse.json(
      { error: `Could not load site integrations: ${error.message}` },
      { status: 500 },
    )
  }

  const links = ((data ?? []) as unknown as RawRow[]).map(flatten)
  return NextResponse.json({ links })
}

interface CreateBody {
  site_id?:        string
  integration_id?: string
  input_values?:   Record<string, string>
}

/**
 * POST /api/admin/site-integrations
 * Body: { site_id, integration_id }
 *
 * Inserts the link row, then immediately calls the provider for any
 * integrations that need a remote resource (currently: betterstack).
 * The lifecycle column is updated as we go so the admin UI can reflect
 * pending → provisioning → active / error.
 */
export async function POST(request: Request) {
  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { site_id, integration_id, input_values } = body
  if (!site_id || !integration_id) {
    return NextResponse.json(
      { error: 'site_id and integration_id are both required.' },
      { status: 400 },
    )
  }

  const sr = createServiceRoleClient()

  const { data: integrationRow, error: intErr } = await sr
    .from('integrations')
    .select('*')
    .eq('id', integration_id)
    .maybeSingle()
  if (intErr || !integrationRow) {
    return NextResponse.json({ error: 'Integration not found.' }, { status: 404 })
  }
  const integration = integrationRow as Integration

  if (!integration.enabled) {
    return NextResponse.json(
      { error: `${integration.name} isn't enabled. Configure and enable it first in /admin/integrations.` },
      { status: 400 },
    )
  }
  const missing = missingRequiredFields(integration)
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${integration.name} is missing required configuration: ${missing.join(', ')}.` },
      { status: 400 },
    )
  }

  const { data: site, error: siteErr } = await sr
    .from('sites')
    .select('id, domain, display_name, review_tracking_mode')
    .eq('id', site_id)
    .maybeSingle()
  if (siteErr || !site) {
    return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
  }

  const { data: created, error: insertErr } = await sr
    .from('site_integrations')
    .insert({
      site_id,
      integration_id,
      status:     'pending',
      last_error: null,
      input_values: input_values ?? {},
    })
    .select('*')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json(
        { error: 'That integration is already linked to this site.' },
        { status: 409 },
      )
    }
    console.error('insert site integration failed:', insertErr)
    return NextResponse.json(
      { error: `Could not link integration: ${insertErr.message}` },
      { status: 500 },
    )
  }

  const link = created as SiteIntegration

  await sr
    .from('site_integrations')
    .update({ status: 'provisioning' })
    .eq('id', link.id)

  try {
    const finalLink = await provisionForIntegration({
      integration,
      site:        { id: site_id, domain: site.domain as string, display_name: site.display_name as string | null },
      siteIntegrationId: link.id,
      perSiteValues: input_values ?? {},
    })
    return NextResponse.json({ link: finalLink }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provisioning failed.'
    console.error('[site-integration provision]', err)

    const { data: errored } = await sr
      .from('site_integrations')
      .update({ status: 'error', last_error: message })
      .eq('id', link.id)
      .select('*, integration:integrations ( key, name )')
      .single()

    return NextResponse.json(
      {
        error: message,
        link:  errored ? flatten(errored as unknown as RawRow) : null,
      },
      { status: 502 },
    )
  }
}

/**
 * Routes to the right provider based on `integration.key`.
 * Returns the freshly-fetched link row (joined for the UI).
 */
async function provisionForIntegration({
  integration,
  site,
  siteIntegrationId,
  perSiteValues,
}: {
  integration:       Integration
  site:              { id: string; domain: string; display_name: string | null }
  siteIntegrationId: string
  perSiteValues:     Record<string, string>
}): Promise<SiteIntegrationListItem> {
  const sr      = createServiceRoleClient()
  const values  = (integration.input_values ?? {}) as Record<string, string>
  const url     = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`

  if (integration.key === 'google_places') {
    const placeId = perSiteValues.place_id
    const mode    = (perSiteValues.mode ?? 'summary') as 'full' | 'summary'
    if (!placeId) throw new Error('Google Place ID is required.')

    await sr.from('sites').update({
      google_place_id:      placeId,
      review_tracking_mode: mode,
    }).eq('id', site.id)

    await sr.from('site_integrations').update({
      status:         'active',
      provisioned_at: new Date().toISOString(),
      last_error:     null,
    }).eq('id', siteIntegrationId)

  } else if (integration.key === 'trustpilot') {
    const domain = perSiteValues.domain
    const mode   = (perSiteValues.mode ?? 'summary') as 'full' | 'summary'
    if (!domain) throw new Error('Trustpilot business domain is required.')

    await sr.from('sites').update({
      trustpilot_domain:    domain,
      review_tracking_mode: mode,
    }).eq('id', site.id)

    await sr.from('site_integrations').update({
      status:         'active',
      provisioned_at: new Date().toISOString(),
      last_error:     null,
    }).eq('id', siteIntegrationId)

  } else if (integration.key === 'betterstack') {
    const apiKey = values.api_key
    if (!apiKey) throw new Error('Better Stack API key is missing.')

    const name = site.display_name?.trim() || site.domain
    const { monitor_id } = await createMonitor(apiKey, url, name)

    await sr
      .from('site_integrations')
      .update({
        status:               'active',
        provider_resource_id: monitor_id,
        provisioned_at:       new Date().toISOString(),
        last_error:           null,
      })
      .eq('id', siteIntegrationId)
  } else if (isAuditIntegrationKey(integration.key)) {
    const apiKey = values.api_key
    if (!apiKey) throw new Error(`${integration.name} API key is missing.`)

    // No remote resource — run the audit synchronously and store the
    // returned JSON on the link row so the UI can render it.
    const audit = await runAuditForKey(integration.key, apiKey, url)

    await sr
      .from('site_integrations')
      .update({
        status:            'active',
        provider_metadata: audit.result,
        provisioned_at:    new Date().toISOString(),
        last_error:        null,
      })
      .eq('id', siteIntegrationId)
  } else {
    // Integrations without a remote resource → mark active immediately.
    await sr
      .from('site_integrations')
      .update({
        status:         'active',
        provisioned_at: new Date().toISOString(),
        last_error:     null,
      })
      .eq('id', siteIntegrationId)
  }

  const { data, error } = await sr
    .from('site_integrations')
    .select(`
      id, site_id, integration_id, status,
      provider_resource_id, provider_metadata,
      input_values,
      last_error, provisioned_at,
      created_at, updated_at,
      integration:integrations ( key, name )
    `)
    .eq('id', siteIntegrationId)
    .single()

  if (error || !data) {
    throw new Error('Provisioned but could not reload the row.')
  }
  return flatten(data as unknown as RawRow)
}
