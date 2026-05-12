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

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name, is_admin')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        email={user.email ?? ''}
        name={profile?.full_name ?? null}
        company={profile?.company_name ?? null}
        isAdmin={Boolean(profile?.is_admin)}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-10 md:px-8 md:py-12">
          {children}
        </div>
      </main>
    </div>
  )
}
