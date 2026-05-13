'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'

interface Props {
  customerId: string
}

export default function AddSiteButton({ customerId }: Props) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [domain, setDomain]   = useState('')
  const [display, setDisplay] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) close() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => firstInputRef.current?.focus(), 50)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saving])

  function close() {
    if (saving) return
    setOpen(false)
    setError(null)
    setDomain('')
    setDisplay('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/sites`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ domain, display_name: display }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not add domain.')
        return
      }
      setOpen(false)
      setDomain('')
      setDisplay('')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800"
      >
        <Plus className="h-3.5 w-3.5" />
        Add domain
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-navy-100 px-6 py-4">
              <h2 className="text-base font-bold text-navy-900">Add a domain</h2>
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="rounded-full p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3 px-6 py-5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-navy-700">
                  Domain
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  inputMode="url"
                  required
                  autoComplete="off"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  placeholder="example.com"
                  className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-navy-700">
                  Display name <span className="text-navy-400">(optional)</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={display}
                  onChange={e => setDisplay(e.target.value)}
                  placeholder="My main site"
                  className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  disabled={saving}
                  className="rounded-full border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {saving ? 'Adding…' : 'Add domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
