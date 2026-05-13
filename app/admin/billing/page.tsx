import { getAllPayments, getAllSitesWithOwners } from '@/lib/services/billing'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminBillingClient from './AdminBillingClient'

export const metadata = { title: 'Billing — Admin' }

export default async function AdminBillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [payments, sites] = await Promise.all([
    getAllPayments(),
    getAllSitesWithOwners(),
  ])

  return <AdminBillingClient payments={payments} sites={sites} />
}
