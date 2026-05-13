import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PatchBody {
  display_name?: string | null
}

interface RouteCtx {
  params: Promise<{ id: string; siteId: string }>
}

/**
 * PATCH — update a site's metadata. Integration attachments are
 * handled separately via /api/admin/site-integrations.
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const { id: customerId, siteId } = await ctx.params

  const guard = await requireAdmin()
  if (guard) return guard

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Build the patch from explicit allow-list fields only.
  const patch: Record<string, unknown> = {}
  if (typeof body.display_name === 'string') {
    const trimmed = body.display_name.trim()
    patch.display_name = trimmed.length > 0 ? trimmed : null
  } else if (body.display_name === null) {
    patch.display_name = null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Scope the update by (id, owner_id) so an admin can't accidentally
  // (or maliciously) PATCH a site owned by someone else through this
  // customer's route.
  const { data: updated, error } = await admin
    .from('sites')
    .update(patch)
    .eq('id', siteId)
    .eq('owner_id', customerId)
    .select('id, domain, display_name, owner_id')
    .maybeSingle()

  if (error) {
    console.error('site update failed:', error)
    const detail = error.hint ? `${error.message} (${error.hint})` : error.message
    return NextResponse.json(
      { error: `Could not update site: ${detail}` },
      { status: 500 }
    )
  }

  if (!updated) {
    return NextResponse.json(
      { error: 'Site not found for this customer.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ site: updated })
}

/**
 * DELETE — unlink a site from a customer.
 */
export async function DELETE(_request: Request, ctx: RouteCtx) {
  const { id: customerId, siteId } = await ctx.params

  const guard = await requireAdmin()
  if (guard) return guard

  const admin = createAdminClient()

  const { data: deleted, error } = await admin
    .from('sites')
    .delete()
    .eq('id', siteId)
    .eq('owner_id', customerId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('site delete failed:', error)
    const detail = error.hint ? `${error.message} (${error.hint})` : error.message
    return NextResponse.json(
      { error: `Could not remove site: ${detail}` },
      { status: 500 }
    )
  }

  if (!deleted) {
    return NextResponse.json(
      { error: 'Site not found for this customer.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true })
}

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }
  const { data: isAdmin, error } = await supabase.rpc('is_current_user_admin')
  if (error) {
    console.error('admin check failed:', error)
    return NextResponse.json({ error: 'Admin check failed.' }, { status: 500 })
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
  }
  return null
}
