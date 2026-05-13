import { NextResponse, type NextRequest } from 'next/server'
import { constructWebhookEvent } from '@/lib/services/stripe'
import {
  syncInvoicePaid,
  syncInvoiceFailed,
  syncSubscriptionStatus,
} from '@/lib/services/billing'
import type Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    const rawBody = await request.arrayBuffer()
    const payload = Buffer.from(rawBody)
    event = constructWebhookEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.id) await syncInvoicePaid(invoice.id)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.id) await syncInvoiceFailed(invoice.id)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscriptionStatus(subscription.id, subscription.status)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscriptionStatus(subscription.id, 'canceled')
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
