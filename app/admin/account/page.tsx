import { requireAdmin } from '@/lib/auth/admin-guard'
import { createClient } from '@/lib/supabase/server'
import AccountForm from '@/app/portal/account/AccountForm'

export const dynamic = 'force-dynamic'

export default async function AdminAccountPage() {
  const { email } = await requireAdmin()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, company_name, phone')
    .eq('id', user!.id)
    .maybeSingle()

  if (error) {
    console.error('admin/account: load profile failed:', error)
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Account
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          Your details<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Update your contact and business information.
        </p>
      </div>

      <AccountForm
        email={email}
        initialFullName={profile?.full_name    ?? ''}
        initialCompany ={profile?.company_name ?? ''}
        initialPhone   ={profile?.phone        ?? ''}
      />
    </div>
  )
}
