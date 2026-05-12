'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Plus, X } from 'lucide-react'

interface NewCustomerResponse {
  customer?: { id: string; email: string }
  invite_sent?: boolean
  error?: string
}

export default function NewCustomerButton() {
  const [open, setOpen]       = useState(false)
  const [email, setEmail]     = useState('')
  const [fullName, setName]   = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone]     = useState('')
  const [sendInvite, setInv]  = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<{ email: string; invite_sent: boolean } | null>(null)

  const router = useRouter()
  const firstInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setEmail('')
    setName('')
    setCompany('')
    setPhone('')
    setInv(true)
    setError(null)
    setSuccess(null)
  }

  function close() {
    if (loading) return
    setOpen(false)
    setTimeout(reset, 200)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    setTimeout(() => firstInputRef.current?.focus(), 50)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/customers', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          email,
          full_name:    fullName,
          company_name: company,
          phone,
          send_invite:  sendInvite,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as NewCustomerResponse

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setSuccess({ email: data.customer?.email ?? email, invite_sent: !!data.invite_sent })
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800"
      >
        <Plus className="h-3.5 w-3.5" />
        Add customer
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm transition-opacity"
            onClick={close}
          />

          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-navy-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Admin
                </p>
                <h2 className="mt-1 text-lg font-bold text-navy-900">
                  New customer<span className="text-brand-500">.</span>
                </h2>
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

            {success ? (
              <div className="px-6 py-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-navy-900">
                  Customer created
                </h3>
                <p className="mt-2 text-sm text-navy-600">
                  {success.invite_sent
                    ? <>An invitation email has been sent to <strong className="text-navy-900">{success.email}</strong>.</>
                    : <><strong className="text-navy-900">{success.email}</strong> is ready. No invitation email was sent.</>}
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    onClick={() => { reset(); }}
                    className="rounded-full border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 transition hover:bg-navy-50"
                  >
                    Add another
                  </button>
                  <button
                    onClick={close}
                    className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
                <Field label="Email" required>
                  <input
                    ref={firstInputRef}
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="input"
                  />
                </Field>

                <Field label="Full name">
                  <input
                    type="text"
                    autoComplete="off"
                    value={fullName}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="input"
                  />
                </Field>

                <Field label="Company">
                  <input
                    type="text"
                    autoComplete="off"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="Acme Ltd"
                    className="input"
                  />
                </Field>

                <Field label="Phone">
                  <input
                    type="tel"
                    autoComplete="off"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+44 7700 900123"
                    className="input"
                  />
                </Field>

                <label className="flex items-start gap-3 rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={sendInvite}
                    onChange={e => setInv(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs text-navy-700">
                    <span className="font-semibold text-navy-900">Send invitation email</span>
                    <span className="block text-navy-500">
                      Sends a branded magic link via Brevo so they can activate their account.
                    </span>
                  </span>
                </label>

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
                    className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {loading ? 'Creating…' : 'Create customer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Local input style — co-located so we don't touch global CSS. */}
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
        .input::placeholder {
          color: #94a8c0;
        }
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
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
        {label}
        {required && <span className="ml-1 text-brand-600">*</span>}
      </span>
      {children}
    </label>
  )
}
