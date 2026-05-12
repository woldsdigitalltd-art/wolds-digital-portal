import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiAdmin } from '@/lib/services/admin-guard'
import { isStatus, sanitiseDataAgainstSchema } from '@/lib/services/types'
import type { SiteServiceStatus } from '@/lib/services/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ siteId: string }>
}

/**
 * Shape returned to the admin UI for each linked service. The UI
 * needs the chosen auth_method label and the raw credentials so it
 * can pre-populate the edit form.
 */
export interface SiteServiceListItem {
  id:                   string
  site_id:              string
  service_id:           string
  service_key:          string
  service_name:         string
  service_icon:         string | null
  auth_type_id:         string | null
  auth_type:            string | null
  auth_type_label:      string | null
  credentials:          Record<string, unknown> | null
  status:               SiteServiceStatus
  provider_resource_id: string | null
  last_error:           string | null
  provisioned_at:       string | null
  created_at:           string
  updated_at:           string
}

interface RawRow {
  id:                   string
  site_id:              string
  service_id:           string
  auth_type_id:         string | null
  credentials:          Record<string, unknown> | null
  status:               SiteServiceStatus
  provider_resource_id: string | null
  last_error:           string | null
  provisioned_at:       string | null
  created_at:           string
  updated_at:           string
  services:             { key: string; name: string; icon: string | null } | null
  service_auth_types:   { auth_type: string; label: string } | null
}

function flatten(row: RawRow): SiteServiceListItem {
  return {
    id:                   row.id,
    site_id:              row.site_id,
    service_id:           row.service_id,
    service_key:          row.services?.key  ?? '',
    service_name:         row.services?.name ?? '',
    service_icon:         row.services?.icon ?? null,
    auth_type_id:         row.auth_type_id,
    auth_type:            row.service_auth_types?.auth_type ?? null,
    auth_type_label:      row.service_auth_types?.label     ?? null,
    credentials:          row.credentials,
    status:               row.status,
    provider_resource_id: row.provider_resource_id,
    last_error:           row.last_error,
    provisioned_at:       row.provisioned_at,
    created_at:           row.created_at,
    updated_at:           row.updated_at,
  }
}

/** GET — list services attached to this site. */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { siteId } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('site_services')
    .select(`
      id, site_id, service_id, auth_type_id, credentials, status,
      provider_resource_id, last_error, provisioned_at, created_at, updated_at,
      services:service_id ( key, name, icon ),
      service_auth_types:auth_type_id ( auth_type, label )
    `)
    .eq('site_id', siteId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('list site services failed:', error)
    return NextResponse.json(
      { error: `Could not load site services: ${error.message}` },
      { status: 500 }
    )
  }

  const rows = ((data ?? []) as unknown as RawRow[]).map(flatten)
  return NextResponse.json({ links: rows })
}

interface CreateBody {
  service_id?:   string
  auth_type_id?: string
  credentials?:  Record<string, unknown>
  status?:       SiteServiceStatus
}

/**
 * POST — attach (or re-attach) a service to a site.
 *
 *  • Validates the supplied auth_type_id belongs to service_id.
 *  • Sanitises credentials against the auth option's settings_schema.
 *  • Default status is derived from services.provisioning_required
 *    (true → 'pending', false → 'active') unless caller overrides.
 *  • Uses upsert on (site_id, service_id) so a previously cancelled
 *    row is revived rather than violating the uniqueness constraint.
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

  if (!body.service_id) {
    return NextResponse.json({ error: 'service_id is required.' }, { status: 400 })
  }
  if (!body.auth_type_id) {
    return NextResponse.json({ error: 'auth_type_id is required.' }, { status: 400 })
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

  const { data: service, error: serviceErr } = await admin
    .from('services')
    .select('id, provisioning_required, enabled')
    .eq('id', body.service_id)
    .maybeSingle()
  if (serviceErr || !service) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 })
  }
  if (!service.enabled) {
    return NextResponse.json(
      { error: 'That service is currently disabled.' },
      { status: 400 }
    )
  }

  const { data: authOpt, error: authErr } = await admin
    .from('service_auth_types')
    .select('id, settings_schema')
    .eq('id',         body.auth_type_id)
    .eq('service_id', body.service_id)
    .maybeSingle()
  if (authErr || !authOpt) {
    return NextResponse.json(
      { error: 'Auth option not found for this service.' },
      { status: 400 }
    )
  }

  const cleanCreds = sanitiseDataAgainstSchema(
    (authOpt.settings_schema as { fields: never[] } | null) ?? null,
    body.credentials ?? {},
  )

  let status: SiteServiceStatus
  if (body.status && isStatus(body.status)) {
    status = body.status
  } else {
    status = service.provisioning_required ? 'pending' : 'active'
  }

  const { data: inserted, error: insertErr } = await admin
    .from('site_services')
    .upsert(
      {
        site_id:       siteId,
        service_id:    body.service_id,
        auth_type_id:  body.auth_type_id,
        credentials:   cleanCreds,
        status,
        last_error:    null,
      },
      { onConflict: 'site_id,service_id' }
    )
    .select('id')
    .single()

  if (insertErr) {
    console.error('attach service failed:', insertErr)
    return NextResponse.json(
      { error: `Could not attach service: ${insertErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: inserted.id, status }, { status: 201 })
}
