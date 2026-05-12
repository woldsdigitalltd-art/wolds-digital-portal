import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Ensures the current request is from an authenticated admin user.
 *
 * Behaviour:
 *   - Not signed in            → redirect to /
 *   - Signed in, not admin     → redirect to /portal
 *   - Signed in admin          → returns { userId, email }
 */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: isAdmin, error } = await supabase.rpc('is_current_user_admin')

  if (error) {
    console.error('Admin check failed:', error)
    redirect('/portal')
  }

  if (!isAdmin) {
    redirect('/portal')
  }

  return { userId: user.id, email: user.email ?? '' }
}
