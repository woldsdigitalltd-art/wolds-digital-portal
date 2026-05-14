'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Send } from 'lucide-react'

export default function CommentForm({ incidentId }: { incidentId: string }) {
  const router    = useRouter()
  const ref       = useRef<HTMLTextAreaElement>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = ref.current?.value.trim() ?? ''
    if (!body) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/incidents/${incidentId}/comments`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ body }),
    })

    setLoading(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Failed to post comment.')
      return
    }
    if (ref.current) ref.current.value = ''
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/60 shadow-soft backdrop-blur-sm focus-within:ring-2 focus-within:ring-brand-500/30">
        <textarea
          ref={ref}
          rows={3}
          placeholder="Add a comment…"
          className="w-full resize-none bg-transparent px-4 pt-3 text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none"
          disabled={loading}
        />
        <div className="flex items-center justify-between border-t border-white/40 px-3 py-2">
          {error
            ? <p className="text-xs text-red-600">{error}</p>
            : <span />
          }
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </form>
  )
}
