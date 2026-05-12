import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import { isIntegrationStatus } from '@/lib/integrations/types'
import type { IntegrationStatus } from '@/lib/integrations/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ siteId: string }>
}

/** Shape returned to the admin UI per row. */
export interface SiteIntegrationListItem {
  id:                   string
  site_id:              string
  integration_id:       string
  integration_key:      string
  integration_name:     string
  integration_icon:     string | null
  integration_provider: string | null
  config:               Record<string, unknown> | null
  status:               IntegrationStatus
  provider_resource_id: string | null
  provider_metadata:    Record<string, unknown> | null
  last_error:           string | null
  provisioned_at:       string | null
  created_at:           string
  updated_at:           string
}

interface RawRow {
  id:                   string
  site_id:              string
  integration_id:       string
  config:               Record<string, unknown> | null
  status:               IntegrationStatus
  provider_resource_id: string | null
  provider_metadata:    Record<string, unknown> | null
  last_error:           string | null
  provisioned_at:       string | null
  created_at:           string
  updated_at:           string
  integrations: {
    key:      string
    name:     string
    icon:     string | null
    provider: string | null
  } | null
}

function flatten(row: RawRow): SiteIntegrationListItem {
  return {
    id:                   row.id,
    site_id:              row.site_id,
    integration_id:       row.integration_id,
    integration_key:      row.integrations?.key      ?? '',
    integration_name:     row.integrations?.name     ?? '',
    integration_icon:     row.integrations?.icon     ?? null,
    integration_provider: row.integrations?.provider ?? null,
    config:               row.config,
    status:               row.status,
    provider_resource_id: row.provider_resource_id,
    provider_metadata:    row.provider_metadata,
    last_error:           row.last_error,
    provisioned_at:       row.provisioned_at,
    created_at:           row.created_at,
    updated_at:           row.updated_at,
  }
}

/** GET — list integrations attached to this site. */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { siteId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_integrations')
    .select(`
      id, site_id, integration_id, config, status,
      provider_resource_id, provider_metadata, last_error,
      provisioned_at, created_at, updated_at,
      integrations:integration_id ( key, name, icon, provider )
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

  const rows = ((data ?? []) as unknown as RawRow[]).map(flatten)
  return NextResponse.json({ links: rows })
}

interface CreateBody {
  integration_id?: string
  config?:         Record<string, unknown>
  status?:         IntegrationStatus
}

/**
 * POST — attach an integration to a site.
 *
 * Status starts as `pending`; the orchestrator at
 * /api/admin/provision-integration will move it forward.
 *
 * If a row already exists for (site_id, integration_id) — typically
 * one previously marked `cancelled` — we revive it via upsert
 * rather than violating the uniqueness constraint.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const { siteId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.integration_id) {
    return NextResponse.json({ error: 'integration_id is required.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: site, error: siteErr } = await admin
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .maybeSingle()
  if (siteErr || !site) {
    return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
  }

  const { data: integration, error: intErr } = await admin
    .from('integrations')
    .select('id, enabled')
    .eq('id', body.integration_id)
    .maybeSingle()
  if (intErr || !integration) {
    return NextResponse.json({ error: 'Integration not found.' }, { status: 404 })
  }
  if (!integration.enabled) {
    return NextResponse.json({ error: 'That integration is currently disabled.' }, { status: 400 })
  }

  const status: IntegrationStatus =
    body.status && isIntegrationStatus(body.status) ? body.status : 'pending'

  const { data: inserted, error: insertErr } = await admin
    .from('site_integrations')
    .upsert(
      {
        site_id:        siteId,
        integration_id: body.integration_id,
        config:         body.config ?? {},
        status,
        last_error:     null,
      },
      { onConflict: 'site_id,integration_id' },
    )
    .select('id')
    .single()

  if (insertErr) {
    console.error('attach integration failed:', insertErr)
    return NextResponse.json(
      { error: `Could not attach integration: ${insertErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ id: inserted.id, status }, { status: 201 })
}
