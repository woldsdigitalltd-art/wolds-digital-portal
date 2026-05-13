'use client'

import { useState } from 'react'
import { CreditCard, Plus, RefreshCw } from 'lucide-react'

type Payment = {
  id: string
  type: 'one_off' | 'subscription'
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'void'
  description: string | null
  hosted_invoice_url: string | null
  invoice_pdf_url: string | null
  created_at: string
  profiles: { full_name: string | null; company_name: string | null }
}

type Site = {
  id: string
  domain: string
  display_name: string
  owner_id: string
  stripe_subscription_id: string | null
  profiles: { full_name: string | null; company_name: string | null }
}

type Props = {
  payments: Payment[]
  sites: Site[]
}

const statusStyles: Record<string, string> = {
  paid: 'bg-brand-100 text-brand-700',
  pending: 'bg-navy-100 text-navy-700',
  failed: 'bg-red-100 text-red-700',
  void: 'bg-navy-50 text-navy-400',
}

function formatAmount(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100)
}

function ownerLabel(profiles: { full_name: string | null; company_name: string | null }): string {
  return profiles.company_name ?? profiles.full_name ?? '—'
}

export default function AdminBillingClient({ payments, sites }: Props) {
  const [tab, setTab] = useState<'payments' | 'raise-payment' | 'raise-subscription'>('payments')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [paymentForm, setPaymentForm] = useState({
    siteId: '',
    amount: '',
    description: '',
    daysUntilDue: '7',
  })

  const [subForm, setSubForm] = useState({
    siteId: '',
    monthlyAmount: '',
    startDate: '',
  })

  async function handleRaisePayment() {
    setLoading(true)
    setMessage(null)
    try {
      const site = sites.find(s => s.id === paymentForm.siteId)
      if (!site) throw new Error('Select a site')

      const res = await fetch('/api/stripe/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: site.owner_id,
          siteId: paymentForm.siteId,
          amountInPounds: paymentForm.amount,
          description: paymentForm.description,
          daysUntilDue: parseInt(paymentForm.daysUntilDue),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Invoice created and sent to client.' })
      setPaymentForm({ siteId: '', amount: '', description: '', daysUntilDue: '7' })
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
      const site = sites.find(s => s.id === subForm.siteId)
      if (!site) throw new Error('Select a site')

      const res = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: site.owner_id,
          siteId: subForm.siteId,
          monthlyAmountInPounds: subForm.monthlyAmount,
          startDate: subForm.startDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Subscription created. First invoice sent to client.' })
      setSubForm({ siteId: '', monthlyAmount: '', startDate: '' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-page-gradient font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-navy-900" />
            <h1 className="text-2xl font-semibold text-navy-900">Billing</h1>
          </div>
        </header>

        <div className="flex gap-2 mb-6">
          {[
            { key: 'payments', label: 'All Payments' },
            { key: 'raise-payment', label: '+ One-off Payment' },
            { key: 'raise-subscription', label: '+ Subscription' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key as typeof tab); setMessage(null) }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-navy-900 text-white'
                  : 'border border-navy-200 text-navy-700 hover:bg-navy-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-brand-100 text-brand-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {tab === 'payments' && (
          <div className="rounded-xl bg-white shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50">
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Client</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Description</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Type</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Amount</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Date</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-navy-400">
                      No payments yet
                    </td>
                  </tr>
                )}
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-navy-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-navy-900">{ownerLabel(p.profiles)}</p>
                    </td>
                    <td className="px-6 py-4 text-navy-700">{p.description ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-medium text-navy-700 capitalize">
                        {p.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-navy-900">
                      {formatAmount(p.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[p.status] ?? ''}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-navy-500 text-xs">
                      {new Date(p.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      {p.hosted_invoice_url && (
                        <a
                          href={p.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-navy-500 hover:text-navy-900 underline"
                        >
                          View
                        </a>
                      )}
                      {p.invoice_pdf_url && (
                        <a
                          href={p.invoice_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-navy-500 hover:text-navy-900 underline"
                        >
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'raise-payment' && (
          <div className="rounded-xl bg-white shadow-soft p-6 max-w-lg">
            <h2 className="text-lg font-semibold text-navy-900 mb-6">Raise One-off Payment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Site</label>
                <select
                  value={paymentForm.siteId}
                  onChange={e => setPaymentForm(f => ({ ...f, siteId: e.target.value }))}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                >
                  <option value="">Select a site...</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.domain} — {ownerLabel(s.profiles)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Amount (£)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="500.00"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Website setup fee"
                  value={paymentForm.description}
                  onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Payment due (days)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={paymentForm.daysUntilDue}
                  onChange={e => setPaymentForm(f => ({ ...f, daysUntilDue: e.target.value }))}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <button
                onClick={handleRaisePayment}
                disabled={loading || !paymentForm.siteId || !paymentForm.amount || !paymentForm.description}
                className="w-full rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create & Send Invoice
              </button>
            </div>
          </div>
        )}

        {tab === 'raise-subscription' && (
          <div className="rounded-xl bg-white shadow-soft p-6 max-w-lg">
            <h2 className="text-lg font-semibold text-navy-900 mb-6">Create Subscription</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Site</label>
                <select
                  value={subForm.siteId}
                  onChange={e => setSubForm(f => ({ ...f, siteId: e.target.value }))}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                >
                  <option value="">Select a site...</option>
                  {sites
                    .filter(s => !s.stripe_subscription_id)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.domain} — {ownerLabel(s.profiles)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Monthly amount (£)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="199.00"
                  value={subForm.monthlyAmount}
                  onChange={e => setSubForm(f => ({ ...f, monthlyAmount: e.target.value }))}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Start date <span className="text-navy-400 font-normal">(leave blank to start immediately)</span>
                </label>
                <input
                  type="date"
                  value={subForm.startDate}
                  onChange={e => setSubForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <button
                onClick={handleRaiseSubscription}
                disabled={loading || !subForm.siteId || !subForm.monthlyAmount}
                className="w-full rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Subscription & Send Invoice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
