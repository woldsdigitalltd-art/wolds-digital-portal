import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Service role client — bypasses RLS.
 *
 * NEVER expose to the browser. Server-side only.
 *
 * Used for integration flows that need to read provider credentials
 * out of `integrations.input_values` and write back to
 * `site_integrations` as the system, not as the requesting admin
 * user. Also used by the customer portal to fetch live Better Stack
 * status without exposing the API key client-side.
 */
export function createServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    },
  )
}
