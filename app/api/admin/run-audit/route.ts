import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import { isAuditIntegrationKey, runAuditForKey } from '@/lib/integrations/audits'
import type { SiteIntegrationListItem } from '../site-integrations/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/run-audit
 * Body: { site_integration_id: string }
 *
 * Re-runs the audit for any audit-style site_integration (SEO Score,
 * Page Speed, Broken Links). The fresh JSON replaces
 * `provider_metadata`. On failure we mark the row as `error` with the
 * provider's message so the admin UI surfaces it.
 */
interface Body {
  site_integration_id?: string
}

interface JoinedRow {
  id:      string
  site_id: string
  integration_id: string
  status:  string
  provider_resource_id: string | null
  last_error: string | null
  provisioned_at: string | null
  created_at: string
  updated_at: string
  integration: {
    key:          string
    name:         string
    input_values: Record<string, string> | null
  } | null
  site: { domain: string } | null
}

export async function POST(request: Request) {
  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const id = body.site_integration_id
  if (!id) {
    return NextResponse.json(
      { error: 'site_integration_id is required.' },
      { status: 400 },
    )
  }

  const sr = createServiceRoleClient()

  const { data, error: loadErr } = await sr
    .from('site_integrations')
    .select(`
      id, site_id, integration_id, status,
      provider_resource_id, last_error, provisioned_at,
      created_at, updated_at,
      integration:integrations ( key, name, input_values ),
      site:sites ( domain )
    `)
    .eq('id', id)
    .maybeSingle()

  if (loadErr) {
    console.error('load site integration for audit failed:', loadErr)
    return NextResponse.json(
      { error: `Could not load site integration: ${loadErr.message}` },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const row = data as unknown as JoinedRow
  const key = row.integration?.key ?? ''
  if (!isAuditIntegrationKey(key)) {
    return NextResponse.json(
      { error: `Re-run is not supported for ${row.integration?.name ?? 'this integration'}.` },
      { status: 400 },
    )
  }

  const apiKey = row.integration?.input_values?.api_key
  if (!apiKey) {
    return NextResponse.json(
      { error: `${row.integration?.name ?? 'API'} key is not configured.` },
      { status: 400 },
    )
  }
  if (!row.site?.domain) {
    return NextResponse.json(
      { error: 'Site is missing a domain.' },
      { status: 400 },
    )
  }

  const url = row.site.domain.startsWith('http')
    ? row.site.domain
    : `https://${row.site.domain}`

  try {
    const audit = await runAuditForKey(key, apiKey, url)

    const { data: updated, error: updateErr } = await sr
      .from('site_integrations')
      .update({
        status:            'active',
        provider_metadata: audit.result,
        last_error:        null,
      })
      .eq('id', id)
      .select(`
        id, site_id, integration_id, status,
        provider_resource_id, provider_metadata,
        last_error, provisioned_at,
        created_at, updated_at,
        integration:integrations ( key, name )
      `)
      .single()

    if (updateErr || !updated) {
      console.error('store audit failed:', updateErr)
      return NextResponse.json(
        { error: 'Audit ran but could not be saved.' },
        { status: 500 },
      )
    }

    const u = updated as unknown as {
      integration: { key: string; name: string } | null
    } & Omit<SiteIntegrationListItem, 'integration_key' | 'integration_name'>
    const { integration: joined, ...rest } = u
    const link: SiteIntegrationListItem = {
      ...rest,
      integration_key:  joined?.key  ?? '',
      integration_name: joined?.name ?? '',
    }

    return NextResponse.json({ audit: audit.result, key, link })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Audit failed.'
    console.error('[run-audit]', err)

    await sr
      .from('site_integrations')
      .update({ status: 'error', last_error: message })
      .eq('id', id)

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
