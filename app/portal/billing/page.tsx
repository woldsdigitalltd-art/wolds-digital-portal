import { createClient } from '@/lib/supabase/server'
import { getOwnerPayments, getOwnerSites } from '@/lib/services/billing'
import { redirect } from 'next/navigation'
import PortalBillingClient from './PortalBillingClient'

export const metadata = { title: 'Billing — Portal' }

export default async function PortalBillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [payments, sites] = await Promise.all([
    getOwnerPayments(user.id),
    getOwnerSites(user.id),
  ])

  return <PortalBillingClient payments={payments} sites={sites} />
}
