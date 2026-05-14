'use client'

import { useState } from 'react'
import { CheckCircle, RefreshCw, CreditCard } from 'lucide-react'

interface Props {
  customerId: string
  hasStripe: boolean
}

export default function ProvisionStripeButton({ customerId, hasStripe: initialHasStripe }: Props) {
  const [hasStripe, setHasStripe] = useState(initialHasStripe)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hasStripe) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
        <CheckCircle className="h-3 w-3" />
        Connected
      </span>
    )
  }

  async function provision() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: customerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHasStripe(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={provision}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-navy-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-600 hover:bg-navy-50 hover:text-navy-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? <RefreshCw className="h-3 w-3 animate-spin" />
          : <CreditCard className="h-3 w-3" />
        }
        {loading ? 'Creating…' : 'Create Stripe'}
      </button>
      {error && (
        <p className="text-[10px] text-red-600 max-w-[120px] leading-tight">{error}</p>
      )}
    </div>
  )
}
