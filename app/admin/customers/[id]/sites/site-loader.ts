import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WebsiteWithIntegrations } from '@/app/portal/websites/[id]/site-loader'

/**
 * Admin-context site loader. Loads any site (no ownership filter) along
 * with its active integrations, in the same shape the portal views expect.
 *
 * Callers MUST be inside an admin-only route — the surrounding admin
 * layout enforces that via `requireAdmin()`. This function uses the
 * service-role client so RLS is bypassed; do not import from non-admin
 * routes.
 *
 * If `customerId` is supplied, the site must also belong to that customer
 * (defensive scoping for /admin/customers/:id/sites/:siteId).
 */
export const loadSiteAsAdmin = cache(
  async (
    siteId:      string,
    customerId?: string,
  ): Promise<WebsiteWithIntegrations | null> => {
    const admin = createAdminClient()

    let query = admin
      .from('sites')
      .select('id, domain, display_name, owner_id')
      .eq('id', siteId)

    if (customerId) query = query.eq('owner_id', customerId)

    const { data: site, error: siteErr } = await query.maybeSingle()
    if (siteErr) {
      console.error('loadSiteAsAdmin: site fetch failed:', siteErr)
      return null
    }
    if (!site) return null

    const { data: links, error: linksErr } = await admin
      .from('site_integrations')
      .select('integration_id, integrations!inner(id, key, name, enabled)')
      .eq('site_id', siteId)
      .eq('status', 'active')

    if (linksErr) {
      console.error('loadSiteAsAdmin: integrations fetch failed:', linksErr)
      return null
    }

    type LinkRow = { integrations: { id: string; key: string; name: string; enabled: boolean } | null }
    const integrations = ((links ?? []) as unknown as LinkRow[])
      .map(l => l.integrations)
      .filter((i): i is { id: string; key: string; name: string; enabled: boolean } => !!i && i.enabled)
      .map(i => ({ id: i.id, key: i.key, name: i.name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      id:           site.id,
      domain:       site.domain,
      display_name: site.display_name,
      integrations,
    }
  },
)
