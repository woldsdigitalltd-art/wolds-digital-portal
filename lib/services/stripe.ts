import 'server-only'
import Stripe from 'stripe'

function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  })
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripeClient()[prop as keyof Stripe]
  },
})

// ─── Customer ────────────────────────────────────────────────────────────────

export async function createStripeCustomer({
  email,
  name,
  ownerId,
}: {
  email: string
  name: string
  ownerId: string
}): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    name,
    metadata: { ownerId },
  })
}

export async function getStripeCustomer(
  stripeCustomerId: string
): Promise<Stripe.Customer | null> {
  const customer = await stripe.customers.retrieve(stripeCustomerId)
  if (customer.deleted) return null
  return customer as Stripe.Customer
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function getCustomerInvoices(
  stripeCustomerId: string
): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 100,
  })
  return invoices.data
}

export async function getInvoice(
  stripeInvoiceId: string
): Promise<Stripe.Invoice> {
  return stripe.invoices.retrieve(stripeInvoiceId)
}

// ─── One-off payment ──────────────────────────────────────────────────────────

export async function createOneOffInvoice({
  stripeCustomerId,
  amountInPence,
  description,
  siteDomain,
  daysUntilDue = 7,
}: {
  stripeCustomerId: string
  amountInPence: number
  description: string
  siteDomain: string
  daysUntilDue?: number
}): Promise<Stripe.Invoice> {
  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    amount: amountInPence,
    currency: 'gbp',
    description: `${description} — ${siteDomain}`,
  })

  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: 'send_invoice',
    days_until_due: daysUntilDue,
    currency: 'gbp',
    metadata: { siteDomain, type: 'one_off' },
  })

  return stripe.invoices.finalizeInvoice(invoice.id)
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export async function createSiteSubscription({
  stripeCustomerId,
  monthlyAmountInPence,
  siteDomain,
  siteId,
  startDate,
}: {
  stripeCustomerId: string
  monthlyAmountInPence: number
  siteDomain: string
  siteId: string
  startDate?: Date
}): Promise<Stripe.Subscription> {
  const product = await stripe.products.create({
    name: `Monthly SEO Portal — ${siteDomain}`,
    metadata: { siteId },
  })

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: monthlyAmountInPence,
    currency: 'gbp',
    recurring: { interval: 'month' },
  })

  const params: Stripe.SubscriptionCreateParams = {
    customer: stripeCustomerId,
    collection_method: 'send_invoice',
    days_until_due: 7,
    items: [{ price: price.id }],
    metadata: { siteDomain, siteId, type: 'subscription' },
  }

  if (startDate && startDate > new Date()) {
    params.billing_cycle_anchor = Math.floor(startDate.getTime() / 1000)
    params.proration_behavior = 'none'
  }

  return stripe.subscriptions.create(params)
}

export async function cancelSiteSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(stripeSubscriptionId)
}

// ─── Customer Portal ──────────────────────────────────────────────────────────

export async function createCustomerPortalSession({
  stripeCustomerId,
  returnUrl,
}: {
  stripeCustomerId: string
  returnUrl: string
}): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}
