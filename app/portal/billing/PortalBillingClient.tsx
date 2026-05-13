'use client'

import { useState } from 'react'
import { CreditCard, ExternalLink, FileText, RefreshCw } from 'lucide-react'

type Payment = {
  id: string
  type: 'one_off' | 'subscription'
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'void'
  description: string | null
  hosted_invoice_url: string | null
  invoice_pdf_url: string | null
  due_date: string | null
  paid_at: string | null
  created_at: string
}

type Site = {
  id: string
  domain: string
  subscription_status: string
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

const subscriptionStatusStyles: Record<string, string> = {
  active: 'bg-brand-100 text-brand-700',
  trialing: 'bg-navy-100 text-navy-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-navy-50 text-navy-400',
  none: 'bg-navy-50 text-navy-400',
}

function formatAmount(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100)
}

export default function PortalBillingClient({ payments, sites }: Props) {
  const [portalLoading, setPortalLoading] = useState(false)

  async function openBillingPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/customer-portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setPortalLoading(false)
    }
  }

  const pendingPayments = payments.filter(p => p.status === 'pending')
  const totalOwed = pendingPayments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="min-h-screen bg-page-gradient font-sans">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-navy-900" />
            <h1 className="text-2xl font-semibold text-navy-900">Billing</h1>
          </div>
          <button
            onClick={openBillingPortal}
            disabled={portalLoading}
            className="flex items-center gap-2 rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
          >
            {portalLoading
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <ExternalLink className="h-4 w-4" />
            }
            Manage Payment Method
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl bg-white shadow-soft p-5">
            <p className="text-sm text-navy-500 mb-1">Outstanding balance</p>
            <p className="text-2xl font-semibold text-navy-900">{formatAmount(totalOwed)}</p>
          </div>
          <div className="rounded-xl bg-white shadow-soft p-5">
            <p className="text-sm text-navy-500 mb-1">Active subscriptions</p>
            <p className="text-2xl font-semibold text-navy-900">
              {sites.filter(s => s.subscription_status === 'active').length}
            </p>
          </div>
          <div className="rounded-xl bg-white shadow-soft p-5">
            <p className="text-sm text-navy-500 mb-1">Total invoices</p>
            <p className="text-2xl font-semibold text-navy-900">{payments.length}</p>
          </div>
        </div>

        {sites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-navy-900 mb-3">Your Sites</h2>
            <div className="rounded-xl bg-white shadow-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100 bg-navy-50">
                    <th className="px-6 py-3 text-left font-medium text-navy-600">Domain</th>
                    <th className="px-6 py-3 text-left font-medium text-navy-600">Subscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {sites.map(s => (
                    <tr key={s.id}>
                      <td className="px-6 py-4 font-medium text-navy-900">{s.domain}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${subscriptionStatusStyles[s.subscription_status] ?? ''}`}>
                          {s.subscription_status === 'none' ? 'No subscription' : s.subscription_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-base font-semibold text-navy-900 mb-3">Invoice History</h2>
          <div className="rounded-xl bg-white shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50">
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Description</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Amount</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600">Date</th>
                  <th className="px-6 py-3 text-left font-medium text-navy-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-navy-400">
                      No invoices yet
                    </td>
                  </tr>
                )}
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-navy-50 transition-colors">
                    <td className="px-6 py-4 text-navy-800">{p.description ?? '—'}</td>
                    <td className="px-6 py-4 font-medium text-navy-900">{formatAmount(p.amount)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[p.status] ?? ''}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-navy-500 text-xs">
                      {new Date(p.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 flex gap-3">
                      {p.hosted_invoice_url && p.status === 'pending' && (
                        <a
                          href={p.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 transition-colors"
                        >
                          Pay now
                        </a>
                      )}
                      {p.invoice_pdf_url && (
                        <a
                          href={p.invoice_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-navy-500 hover:text-navy-900"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
