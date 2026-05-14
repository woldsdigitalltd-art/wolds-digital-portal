import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  createStripeCustomer,
  createOneOffInvoice,
  createSiteSubscription,
  getCustomerInvoices,
  cancelSiteSubscription,
} from '@/lib/services/stripe'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Site = {
  id: string
  owner_id: string
  domain: string
  display_name: string
  stripe_subscription_id: string | null
  subscription_status: string
  created_at: string
}

export type Payment = {
  id: string
  owner_id: string
  site_id: string | null
  stripe_invoice_id: string | null
  stripe_payment_link_id: string | null
  type: 'one_off' | 'subscription'
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'void'
  description: string | null
  hosted_invoice_url: string | null
  invoice_pdf_url: string | null
  due_date: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export type ProfileWithStripe = {
  id: string
  full_name: string | null
  company_name: string | null
  stripe_customer_id: string | null
  is_admin: boolean
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export async function provisionStripeCustomer(ownerId: string): Promise<void> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, company_name, stripe_customer_id')
    .eq('id', ownerId)
    .single()

  if (error || !profile) throw new Error(`Profile not found: ${ownerId}`)
  if (profile.stripe_customer_id) return

  const { data: authUser } = await supabase.auth.admin.getUserById(ownerId)
  const email = authUser?.user?.email ?? ''

  const stripeCustomer = await createStripeCustomer({
    email,
    name: profile.company_name ?? profile.full_name ?? email,
    ownerId: profile.id,
  })

  // Use service role to bypass RLS and column-level grants — stripe_customer_id
  // is not writable by the `authenticated` role.
  const serviceRole = createServiceRoleClient()
  const { error: updateError } = await serviceRole
    .from('profiles')
    .update({ stripe_customer_id: stripeCustomer.id })
    .eq('id', ownerId)

  if (updateError) throw new Error(`Failed to save stripe_customer_id: ${updateError.message}`)
}

// ─── Sites ────────────────────────────────────────────────────────────────────

export async function getOwnerSites(ownerId: string): Promise<Site[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sites')
    .select('id, owner_id, domain, display_name, stripe_subscription_id, subscription_status, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getAllSitesWithOwners(): Promise<
  (Site & { profiles: { full_name: string | null; company_name: string | null } })[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sites')
    .select('id, owner_id, domain, display_name, stripe_subscription_id, subscription_status, created_at, profiles(full_name, company_name)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as (Site & { profiles: { full_name: string | null; company_name: string | null } })[]
}

// ─── One-off payment ──────────────────────────────────────────────────────────

export async function raiseOneOffPayment({
  ownerId,
  siteId,
  amountInPence,
  description,
  daysUntilDue = 7,
}: {
  ownerId: string
  siteId: string
  amountInPence: number
  description: string
  daysUntilDue?: number
}): Promise<Payment> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', ownerId)
    .single()

  if (!profile?.stripe_customer_id) {
    throw new Error('Owner does not have a Stripe customer ID')
  }

  const { data: site } = await supabase
    .from('sites')
    .select('domain')
    .eq('id', siteId)
    .single()

  if (!site) throw new Error('Site not found')

  const invoice = await createOneOffInvoice({
    stripeCustomerId: profile.stripe_customer_id,
    amountInPence,
    description,
    siteDomain: site.domain,
    daysUntilDue,
  })

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      owner_id: ownerId,
      site_id: siteId,
      stripe_invoice_id: invoice.id,
      type: 'one_off',
      amount: amountInPence,
      currency: 'gbp',
      status: 'pending',
      description,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf_url: invoice.invoice_pdf,
      due_date: invoice.due_date
        ? new Date(invoice.due_date * 1000).toISOString()
        : null,
    })
    .select()
    .single()

  if (error) throw error
  return payment
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export async function raiseSubscription({
  ownerId,
  siteId,
  monthlyAmountInPence,
  startDate,
}: {
  ownerId: string
  siteId: string
  monthlyAmountInPence: number
  startDate?: Date
}): Promise<void> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', ownerId)
    .single()

  if (!profile?.stripe_customer_id) {
    throw new Error('Owner does not have a Stripe customer ID')
  }

  const { data: site } = await supabase
    .from('sites')
    .select('domain, stripe_subscription_id')
    .eq('id', siteId)
    .single()

  if (!site) throw new Error('Site not found')
  if (site.stripe_subscription_id) {
    throw new Error('This site already has an active subscription')
  }

  const subscription = await createSiteSubscription({
    stripeCustomerId: profile.stripe_customer_id,
    monthlyAmountInPence,
    siteDomain: site.domain,
    siteId,
    startDate,
  })

  await supabase
    .from('sites')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
    })
    .eq('id', siteId)
}

export async function cancelSubscription(siteId: string): Promise<void> {
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('stripe_subscription_id')
    .eq('id', siteId)
    .single()

  if (!site?.stripe_subscription_id) {
    throw new Error('No subscription found for this site')
  }

  await cancelSiteSubscription(site.stripe_subscription_id)

  await supabase
    .from('sites')
    .update({ subscription_status: 'canceled', stripe_subscription_id: null })
    .eq('id', siteId)
}

// ─── Payments (read) ──────────────────────────────────────────────────────────

export async function getOwnerPayments(ownerId: string): Promise<Payment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getAllPayments(): Promise<
  (Payment & { profiles: { full_name: string | null; company_name: string | null } })[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*, profiles(full_name, company_name)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as (Payment & { profiles: { full_name: string | null; company_name: string | null } })[]
}

// ─── Webhook sync ─────────────────────────────────────────────────────────────

export async function syncInvoicePaid(stripeInvoiceId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('stripe_invoice_id', stripeInvoiceId)
}

export async function syncInvoiceFailed(stripeInvoiceId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('payments')
    .update({ status: 'failed' })
    .eq('stripe_invoice_id', stripeInvoiceId)
}

export async function syncSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('sites')
    .update({ subscription_status: status })
    .eq('stripe_subscription_id', stripeSubscriptionId)
}
