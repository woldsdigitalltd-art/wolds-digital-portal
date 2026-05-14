'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import type { Payment } from '@/lib/services/billing'

interface Props {
  customerId:           string
  siteId:               string
  siteDomain:           string
  hasStripeCustomer:    boolean
  stripeSubscriptionId: string | null
  subscriptionStatus:   string | null
  initialPayments:      Payment[]
}

type Tab = 'payments' | 'raise-payment' | 'raise-subscription'

const statusStyles: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  paid:    { bg: 'bg-brand-50',  text: 'text-brand-700', ring: 'ring-brand-100', label: 'Paid'    },
  pending: { bg: 'bg-amber-50',  text: 'text-amber-700', ring: 'ring-amber-200', label: 'Pending' },
  failed:  { bg: 'bg-red-50',    text: 'text-red-700',   ring: 'ring-red-200',   label: 'Failed'  },
  void:    { bg: 'bg-navy-50',   text: 'text-navy-500',  ring: 'ring-navy-100',  label: 'Void'    },
}

function formatAmount(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
}

export default function BillingPanel({
  customerId,
  siteId,
  siteDomain,
  hasStripeCustomer,
  stripeSubscriptionId,
  subscriptionStatus,
  initialPayments,
}: Props) {
  const router  = useRouter()
  const [tab,      setTab]      = useState<Tab>('payments')
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [loading,  setLoading]  = useState(false)
  const [message,  setMessage]  = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [paymentForm, setPaymentForm] = useState({
    amount:       '',
    description:  '',
    daysUntilDue: '7',
  })

  const [subForm, setSubForm] = useState({
    monthlyAmount: '',
    startDate:     '',
  })

  function switchTab(t: Tab) {
    setTab(t)
    setMessage(null)
  }

  async function handleRaisePayment() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/stripe/create-payment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId:        customerId,
          siteId,
          amountInPounds: paymentForm.amount,
          description:    paymentForm.description,
          daysUntilDue:   parseInt(paymentForm.daysUntilDue, 10),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Invoice created and sent to client.' })
      setPaymentForm({ amount: '', description: '', daysUntilDue: '7' })
      router.refresh()
      const updated = await fetch(`/api/admin/site-payments?siteId=${siteId}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
      if (updated?.payments) setPayments(updated.payments)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  async function handleRaiseSubscription() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/stripe/create-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId:               customerId,
          siteId,
          monthlyAmountInPounds: subForm.monthlyAmount,
          startDate:             subForm.startDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Subscription created. First invoice sent to client.' })
      setSubForm({ monthlyAmount: '', startDate: '' })
      router.refresh()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
          Billing
        </p>
        <p className="mt-1 text-sm text-navy-600">
          Manage invoices and subscriptions for <span className="font-semibold text-navy-800">{siteDomain}</span>.
        </p>
      </div>

      {!hasStripeCustomer && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This customer has no Stripe account provisioned. Go to the customer profile to set one up before raising invoices.
          </span>
        </div>
      )}

      {stripeSubscriptionId && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-600" />
          <p className="text-xs font-semibold text-brand-800">
            Active subscription
            {subscriptionStatus && (
              <span className="ml-1.5 font-normal text-brand-600">· {subscriptionStatus}</span>
            )}
          </p>
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {([
          { key: 'payments',          label: 'Payments'          },
          { key: 'raise-payment',     label: '+ One-off invoice' },
          { key: 'raise-subscription', label: '+ Subscription'   },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === t.key
                ? 'bg-navy-900 text-white shadow-soft'
                : 'border border-navy-200 bg-white text-navy-700 hover:border-navy-300 hover:bg-navy-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`mb-5 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
          message.type === 'success'
            ? 'border-brand-200 bg-brand-50 text-brand-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {message.type === 'success'
            ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {message.text}
        </div>
      )}

      {tab === 'payments' && (
        payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 px-4 py-8 text-center text-sm text-navy-500">
            <CreditCard className="mx-auto mb-3 h-7 w-7 text-navy-300" />
            No payments yet for this site.
          </div>
        ) : (
          <ul className="space-y-3">
            {payments.map(p => {
              const s = statusStyles[p.status] ?? statusStyles.void
              return (
                <li
                  key={p.id}
                  className="rounded-2xl border border-navy-100 bg-white p-4 shadow-soft"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-navy-900">
                          {p.description ?? 'Invoice'}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${s.bg} ${s.text} ${s.ring}`}>
                          {s.label}
                        </span>
                        <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-medium text-navy-600 capitalize">
                          {p.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-navy-400">
                        {formatAmount(p.amount)} · {new Date(p.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.hosted_invoice_url && (
                        <a
                          href={p.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-700 transition hover:bg-navy-50"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                      {p.invoice_pdf_url && (
                        <a
                          href={p.invoice_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-700 transition hover:bg-navy-50"
                        >
                          <FileText className="h-3 w-3" />
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      )}

      {tab === 'raise-payment' && (
        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft">
          <p className="mb-4 text-sm font-semibold text-navy-900">Raise one-off invoice</p>
          <div className="space-y-4">
            <FormField label="Amount (£)">
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="500.00"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </FormField>
            <FormField label="Description">
              <input
                type="text"
                placeholder="Website setup fee"
                value={paymentForm.description}
                onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </FormField>
            <FormField label="Payment due (days)">
              <input
                type="number"
                min="1"
                max="90"
                value={paymentForm.daysUntilDue}
                onChange={e => setPaymentForm(f => ({ ...f, daysUntilDue: e.target.value }))}
                className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </FormField>
            <button
              type="button"
              onClick={handleRaisePayment}
              disabled={loading || !hasStripeCustomer || !paymentForm.amount || !paymentForm.description}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create &amp; send invoice
            </button>
          </div>
        </div>
      )}

      {tab === 'raise-subscription' && (
        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft">
          <p className="mb-4 text-sm font-semibold text-navy-900">Create subscription</p>
          {stripeSubscriptionId && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This site already has an active subscription.
            </div>
          )}
          <div className="space-y-4">
            <FormField label="Monthly amount (£)">
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="199.00"
                value={subForm.monthlyAmount}
                onChange={e => setSubForm(f => ({ ...f, monthlyAmount: e.target.value }))}
                className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </FormField>
            <FormField label={<>Start date <span className="font-normal text-navy-400">(blank = immediately)</span></>}>
              <input
                type="date"
                value={subForm.startDate}
                onChange={e => setSubForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </FormField>
            <button
              type="button"
              onClick={handleRaiseSubscription}
              disabled={loading || !hasStripeCustomer || !!stripeSubscriptionId || !subForm.monthlyAmount}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Create subscription &amp; send invoice
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-navy-700">
      {label}
      {children}
    </label>
  )
}
