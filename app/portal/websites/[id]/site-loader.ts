import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Per-request site loader for the /portal/websites/[id]/* tree.
 *
 * Calls the `get_my_websites` RPC (which is already filtered to the
 * current user) once, looks up the requested site, and returns null
 * if the user doesn't own it. `cache()` dedupes across the layout
 * and any nested page that calls this in the same render.
 */

export interface WebsiteIntegration {
  id:   string
  key:  string
  name: string
}

export interface WebsiteWithIntegrations {
  id:           string
  domain:       string
  display_name: string | null
  integrations: WebsiteIntegration[]
}

export const loadOwnedSite = cache(
  async (siteId: string): Promise<WebsiteWithIntegrations | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_my_websites')
    if (error) {
      console.error('loadOwnedSite: get_my_websites failed:', error)
      return null
    }
    const sites = (data ?? []) as WebsiteWithIntegrations[]
    return sites.find(s => s.id === siteId) ?? null
  },
)

/** Helpers used by the sub-nav + child pages to gate per-integration views. */
export function hasIntegration(
  site: WebsiteWithIntegrations,
  key:  string,
): boolean {
  return (site.integrations ?? []).some(i => i.key === key)
}
