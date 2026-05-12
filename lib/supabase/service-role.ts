import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Service role client — bypasses RLS.
 *
 * NEVER expose to the browser. Server-side only.
 *
 * Used for provisioning flows that need to read service-level
 * platform credentials (e.g. the Better Stack API key on
 * `services.global_settings_data`) and write back to `site_services`
 * as the system, not as the requesting admin user.
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
