'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import type { Incident } from '@/lib/incidents/types'

export default function AdminIncidentActions({ incident }: { incident: Incident }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [showDismiss, setShowDismiss] = useState(false)
  const [dismissReason, setDismissReason] = useState('')

  async function act(body: object) {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/incidents/${incident.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    setLoading(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Action failed.')
      return
    }
    router.refresh()
  }

  if (incident.status !== 'open' && incident.status !== 'resolved') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white px-4 py-3">
        <p className="text-sm text-navy-500">This incident is <strong>{incident.status}</strong>.</p>
        <button
          onClick={() => act({ action: 'reopen' })}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" /> Re-open
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-navy-100 bg-white px-4 py-3">
        {incident.status === 'open' && (
          <button
            onClick={() => act({ action: 'resolve' })}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <CheckCircle className="h-3 w-3" /> Resolve
          </button>
        )}
        {incident.status === 'open' && !showDismiss && (
          <button
            onClick={() => setShowDismiss(true)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-200 disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" /> Dismiss
          </button>
        )}
        {incident.status === 'resolved' && (
          <button
            onClick={() => act({ action: 'reopen' })}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-200 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" /> Re-open
          </button>
        )}
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </div>

      {showDismiss && (
        <div className="rounded-2xl border border-navy-100 bg-white px-4 py-4 space-y-3">
          <p className="text-xs font-semibold text-navy-700">Dismiss reason (required)</p>
          <textarea
            rows={2}
            value={dismissReason}
            onChange={e => setDismissReason(e.target.value)}
            placeholder="e.g. Client decision — won't implement, Not applicable to this site"
            className="w-full resize-none rounded-xl border border-navy-200 bg-navy-50 px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <div className="flex gap-2">
            <button
              onClick={() => act({ action: 'dismiss', dismiss_reason: dismissReason })}
              disabled={loading || !dismissReason.trim()}
              className="flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" /> Confirm dismiss
            </button>
            <button
              onClick={() => { setShowDismiss(false); setDismissReason('') }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
