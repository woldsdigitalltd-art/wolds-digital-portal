import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountForm from './AccountForm'

export const dynamic = 'force-dynamic'

/**
 * Server component — hydrates the account form with the user's current
 * profile so the fields are populated on first paint. Saving still
 * happens client-side via the browser Supabase client (subject to RLS
 * on `profiles`).
 */
export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // `.maybeSingle()` so a missing row doesn't crash the page — we'll
  // just render an empty form the user can fill in and save.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, company_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('account: load profile failed:', error)
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
        email={user.email ?? ''}
        initialFullName={profile?.full_name    ?? ''}
        initialCompany ={profile?.company_name ?? ''}
        initialPhone   ={profile?.phone        ?? ''}
      />
    </div>
  )
}
