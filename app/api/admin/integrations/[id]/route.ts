import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import {
  MASKED_PASSWORD,
  isReadyToEnable,
  maskPasswordFields,
  missingRequiredFields,
} from '@/lib/integrations/types'
import type { Integration, IntegrationField } from '@/lib/integrations/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

/** GET — single integration row, password fields masked. */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params
  const guard  = await requireApiAdmin()
  if (guard) return guard

  const sr = createServiceRoleClient()
  const { data, error } = await sr
    .from('integrations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('get integration failed:', error)
    return NextResponse.json(
      { error: `Could not load integration: ${error.message}` },
      { status: 500 },
    )
  }
  if (!data) return NextResponse.json({ error: 'Integration not found.' }, { status: 404 })

  return NextResponse.json({ integration: maskPasswordFields(data as Integration) })
}

interface PatchBody {
  /** Partial set of values to merge on top of existing input_values. */
  input_values?: Record<string, string | null>
  /** Toggle the integration on/off platform-wide. */
  enabled?:      boolean
}

/**
 * PATCH /api/admin/integrations/[id]
 * Body: { input_values?: Record<string,string>, enabled?: boolean }
 *
 *   • `input_values` is merged on top of existing values so the admin
 *     can update one field at a time without wiping the rest.
 *   • Empty string or null in a field deletes it.
 *   • Password fields keep their existing value when the browser
 *     re-submits the masked placeholder ("••••••••").
 *   • Setting `enabled: true` is rejected if any required field is
 *     missing, so the platform never has a half-configured integration
 *     marked as live.
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params
  const guard  = await requireApiAdmin()
  if (guard) return guard

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const sr = createServiceRoleClient()

  const { data: existing, error: loadErr } = await sr
    .from('integrations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (loadErr) {
    console.error('load integration for update failed:', loadErr)
    return NextResponse.json(
      { error: `Could not load integration: ${loadErr.message}` },
      { status: 500 },
    )
  }
  if (!existing) {
    return NextResponse.json({ error: 'Integration not found.' }, { status: 404 })
  }

  const current        = existing as Integration
  const currentValues  = (current.input_values    ?? {}) as Record<string, string>
  const requiredFields = (current.required_fields ?? []) as IntegrationField[]
  const fieldByKey     = new Map(requiredFields.map(f => [f.key, f]))

  const updates: Record<string, unknown> = {}

  if (body.input_values && typeof body.input_values === 'object') {
    const merged: Record<string, string> = { ...currentValues }
    for (const [key, raw] of Object.entries(body.input_values)) {
      const field = fieldByKey.get(key)
      if (!field) continue

      if (raw === null) { delete merged[key]; continue }
      if (typeof raw !== 'string') continue

      const trimmed = raw.trim()
      if (trimmed === '') { delete merged[key]; continue }

      // The masked placeholder means "leave the existing password
      // alone" — it's what we send to the browser, never a real value.
      if (field.type === 'password' && trimmed === MASKED_PASSWORD) continue

      merged[key] = trimmed
    }
    updates.input_values = merged
  }

  if (typeof body.enabled === 'boolean') {
    if (body.enabled) {
      const previewValues   = (updates.input_values as Record<string, string> | undefined)
                              ?? currentValues
      const missing = missingRequiredFields({ ...current, input_values: previewValues })
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Fill in the required fields before enabling: ${missing.join(', ')}.` },
          { status: 400 },
        )
      }
    }
    updates.enabled = body.enabled
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const { data: updated, error: updateErr } = await sr
    .from('integrations')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (updateErr) {
    console.error('update integration failed:', updateErr)
    return NextResponse.json(
      { error: `Could not update integration: ${updateErr.message}` },
      { status: 500 },
    )
  }

  const integration = maskPasswordFields(updated as Integration)
  return NextResponse.json({
    integration,
    ready_to_enable: isReadyToEnable(updated as Integration),
  })
}
