import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllSitesWithOwners } from '@/lib/services/billing'
import AdminReviewMonitorClient from './AdminReviewMonitorClient'

export const metadata = { title: 'Review Monitor — Admin' }

export default async function AdminReviewMonitorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const sites = await getAllSitesWithOwners()

  return <AdminReviewMonitorClient sites={sites} />
}
