'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'

export default function NewIntegrationButton() {
  const [open, setOpen]         = useState(false)
  const [name, setName]         = useState('')
  const [key, setKey]           = useState('')
  const [desc, setDesc]         = useState('')
  const [icon, setIcon]         = useState('Boxes')
  const [provider, setProvider] = useState('')
  const [providerUrl, setProviderUrl] = useState('')
  const [provisioningRequired, setProvisioningRequired] = useState(false)
  const [embedEnabled, setEmbedEnabled] = useState(false)
  const [loading, setLoad]      = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const router = useRouter()
  const firstRef = useRef<HTMLInputElement>(null)

  function reset() {
    setName('')
    setKey('')
    setDesc('')
    setIcon('Boxes')
    setProvider('')
    setProviderUrl('')
    setProvisioningRequired(false)
    setEmbedEnabled(false)
    setError(null)
  }
  function close() {
    if (loading) return
    setOpen(false)
    setTimeout(reset, 200)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => firstRef.current?.focus(), 50)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const [keyTouched, setKeyTouched] = useState(false)
  useEffect(() => {
    if (keyTouched) return
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 63)
    setKey(slug)
  }, [name, keyTouched])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoad(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/integrations', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          name,
          key,
          description:           desc,
          icon,
          provider:              provider.trim() || null,
          provider_url:          providerUrl.trim() || null,
          provisioning_required: provisioningRequired,
          embed_enabled:         embedEnabled,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!res.ok || !data.id) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      router.push(`/admin/integrations/${data.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoad(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800"
      >
        <Plus className="h-3.5 w-3.5" />
        New integration
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-navy-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Admin
                </p>
                <h2 className="mt-1 text-lg font-bold text-navy-900">
                  New integration<span className="text-brand-500">.</span>
                </h2>
                <p className="mt-1 text-xs text-navy-500">
                  Credentials are set directly in Supabase — none of that lives in the UI.
                </p>
              </div>
              <button
                onClick={close}
                disabled={loading}
                className="rounded-full p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <Field label="Name" required>
                <input
                  ref={firstRef}
                  type="text"
                  required
                  autoComplete="off"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Uptime Monitoring"
                  className="input"
                />
              </Field>

              <Field label="Key" required hint="Lowercase identifier used in code & URLs.">
                <input
                  type="text"
                  required
                  pattern="[a-z][a-z0-9_-]{1,62}"
                  autoComplete="off"
                  value={key}
                  onChange={e => { setKey(e.target.value); setKeyTouched(true) }}
                  placeholder="uptime"
                  className="input font-mono text-sm"
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  rows={2}
                  placeholder="Live availability monitoring via Better Stack."
                  className="input resize-none"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Icon" hint="lucide-react icon name.">
                  <input
                    type="text"
                    autoComplete="off"
                    value={icon}
                    onChange={e => setIcon(e.target.value)}
                    placeholder="Activity"
                    className="input font-mono text-sm"
                  />
                </Field>
                <Field label="Provider" hint="Free-form vendor label.">
                  <input
                    type="text"
                    autoComplete="off"
                    value={provider}
                    onChange={e => setProvider(e.target.value)}
                    placeholder="betterstack"
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Provider dashboard URL" hint="Where to send admins for vendor controls.">
                <input
                  type="url"
                  autoComplete="off"
                  value={providerUrl}
                  onChange={e => setProviderUrl(e.target.value)}
                  placeholder="https://uptime.betterstack.com/"
                  className="input"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-navy-700">
                  <input
                    type="checkbox"
                    checked={provisioningRequired}
                    onChange={e => setProvisioningRequired(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                  />
                  Provisioning required
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-navy-700">
                  <input
                    type="checkbox"
                    checked={embedEnabled}
                    onChange={e => setEmbedEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                  />
                  Embed enabled
                </label>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="rounded-full border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #dde7f2;
          background: #fff;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: #0b2545;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .input::placeholder { color: #94a8c0; }
        .input:focus {
          outline: none;
          border-color: #7ca653;
          box-shadow: 0 0 0 3px rgba(124, 166, 83, 0.15);
        }
      `}</style>
    </>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
        {label}
        {required && <span className="ml-1 text-brand-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-navy-400">{hint}</span>}
    </label>
  )
}
