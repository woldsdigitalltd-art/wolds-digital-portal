import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import type { Integration, SiteIntegration } from '@/lib/integrations/types'
import { deleteMonitor } from '@/lib/betterstack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/admin/site-integrations/[id]
 *
 * Removes the integration from the site, calling the provider to
 * deprovision the remote resource first when applicable. If the
 * remote call fails we still log it but go ahead with the row
 * deletion — the spec lets the admin intervene in the provider's UI
 * if they need to fully tidy up an orphan monitor.
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params

  const guard = await requireApiAdmin()
  if (guard) return guard

  const sr = createServiceRoleClient()

  const { data: row, error: loadErr } = await sr
    .from('site_integrations')
    .select(`
      id, provider_resource_id,
      integration:integrations ( key, input_values )
    `)
    .eq('id', id)
    .maybeSingle()

  if (loadErr) {
    console.error('load site integration for delete failed:', loadErr)
    return NextResponse.json(
      { error: `Could not load site integration: ${loadErr.message}` },
      { status: 500 },
    )
  }
  if (!row) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const link        = row as unknown as SiteIntegration & {
    integration: Pick<Integration, 'key' | 'input_values'> | null
  }
  const integration = link.integration
  const monitorId   = link.provider_resource_id

  if (monitorId && integration?.key === 'betterstack') {
    const apiKey = (integration.input_values ?? {})['api_key']
    if (apiKey) {
      try {
        await deleteMonitor(apiKey, monitorId)
      } catch (err) {
        // Log and keep going — the admin can clean up in Better Stack
        // directly if a monitor is already gone or detached.
        console.error('[deprovision betterstack]', err)
      }
    }
  }

  const { error: deleteErr } = await sr
    .from('site_integrations')
    .delete()
    .eq('id', id)

  if (deleteErr) {
    console.error('delete site integration failed:', deleteErr)
    return NextResponse.json(
      { error: `Could not remove integration: ${deleteErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
