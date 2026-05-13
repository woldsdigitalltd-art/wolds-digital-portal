import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireApiAdmin } from '@/lib/integrations/admin-guard'
import { maskPasswordFields } from '@/lib/integrations/types'
import type { Integration } from '@/lib/integrations/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/integrations
 * List every integration in the catalogue. Password fields in
 * `input_values` are masked before being sent to the browser.
 */
export async function GET() {
  const guard = await requireApiAdmin()
  if (guard) return guard

  const sr = createServiceRoleClient()
  const { data, error } = await sr
    .from('integrations')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('list integrations failed:', error)
    return NextResponse.json(
      { error: `Could not load integrations: ${error.message}` },
      { status: 500 },
    )
  }

  const integrations = ((data ?? []) as Integration[]).map(maskPasswordFields)
  return NextResponse.json({ integrations })
}
