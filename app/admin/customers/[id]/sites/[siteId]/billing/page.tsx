import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadSiteAsAdmin } from '../../site-loader'
import type { Payment } from '@/lib/services/billing'
import BillingPanel from './BillingPanel'

interface PageProps {
  params: Promise<{ id: string; siteId: string }>
}

export const dynamic = 'force-dynamic'

export default async function AdminSiteBillingPage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params

  const site = await loadSiteAsAdmin(siteId, customerId)
  if (!site) notFound()

  const admin = createAdminClient()

  const [{ data: siteRow }, { data: profile }, { data: payments }] = await Promise.all([
    admin
      .from('sites')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', siteId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('full_name, company_name, stripe_customer_id')
      .eq('id', customerId)
      .maybeSingle(),
    admin
      .from('payments')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false }),
  ])

  return (
    <BillingPanel
      customerId={customerId}
      siteId={siteId}
      siteDomain={site.domain}
      hasStripeCustomer={!!profile?.stripe_customer_id}
      stripeSubscriptionId={siteRow?.stripe_subscription_id ?? null}
      subscriptionStatus={siteRow?.subscription_status ?? null}
      initialPayments={(payments ?? []) as Payment[]}
    />
  )
}
