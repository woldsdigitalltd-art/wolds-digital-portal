import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from './Sidebar'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Pull display data from profiles (subject to RLS — fine, since the
  // user is reading their own row).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle()

  // Admin check goes through the SECURITY DEFINER RPC so RLS can never
  // mask the answer, and it stays consistent with the /admin guard.
  // If the migration hasn't been applied yet the RPC won't exist —
  // treat that as "not admin" rather than crashing the portal.
  let isAdmin = false
  const { data: adminFlag, error: adminError } = await supabase.rpc('is_current_user_admin')
  if (adminError) {
    console.error('is_current_user_admin RPC failed:', adminError)
  } else {
    isAdmin = Boolean(adminFlag)
  }

  // Admins live in the admin panel — the portal client view isn't needed for them.
  if (isAdmin) redirect('/admin')

  return (
    <div className="relative flex h-screen overflow-hidden bg-page-gradient">
      {/* Ambient colour blobs — give the glass sidebar something to refract. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-200/45 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-8rem] h-[32rem] w-[32rem] rounded-full bg-navy-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-12rem] left-[18rem] h-[26rem] w-[26rem] rounded-full bg-brand-100/40 blur-3xl"
      />

      <Sidebar
        email={user.email ?? ''}
        name={profile?.full_name ?? null}
        company={profile?.company_name ?? null}
      />
      <main className="relative flex-1 overflow-y-auto">
        <div
          className="
            mx-auto max-w-5xl px-6 py-10 md:px-8 md:py-12
            has-[[data-fullbleed]]:mx-0 has-[[data-fullbleed]]:max-w-none has-[[data-fullbleed]]:p-0
          "
        >
          {children}
        </div>
      </main>
    </div>
  )
}
