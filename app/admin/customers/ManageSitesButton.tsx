'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Globe, Loader2, Plus, X } from 'lucide-react'

interface Site {
  id:           string
  domain:       string
  display_name: string | null
  owner_id?:    string
}

interface Props {
  customerId:    string
  customerEmail: string
  customerName:  string | null
  initialCount:  number
}

interface ListResponse  { sites?: Site[]; error?: string }
interface AddResponse   { site?:  Site;   error?: string }

export default function ManageSitesButton({
  customerId,
  customerEmail,
  customerName,
  initialCount,
}: Props) {
  const [open, setOpen]       = useState(false)
  const [sites, setSites]     = useState<Site[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)

  const [domain, setDomain]     = useState('')
  const [display, setDisplay]   = useState('')
  const [submitting, setSubmit] = useState(false)
  const [submitErr, setSubErr]  = useState<string | null>(null)

  const router = useRouter()
  const firstInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setDomain('')
    setDisplay('')
    setSubErr(null)
  }

  function close() {
    if (submitting) return
    setOpen(false)
    setTimeout(() => {
      setSites(null)
      setLoadErr(null)
      resetForm()
    }, 200)
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

  // Fetch existing sites when the modal opens.
  useEffect(() => {
    if (!open) return
    let aborted = false
    setLoadingList(true)
    setLoadErr(null)

    fetch(`/api/admin/customers/${customerId}/sites`)
      .then(async r => {
        const data = (await r.json().catch(() => ({}))) as ListResponse
        if (aborted) return
        if (!r.ok) {
          setLoadErr(data.error ?? 'Could not load sites.')
          setSites([])
          return
        }
        setSites(data.sites ?? [])
      })
      .catch(() => {
        if (aborted) return
        setLoadErr('Network error.')
        setSites([])
      })
      .finally(() => {
        if (!aborted) setLoadingList(false)
      })

    return () => {
      aborted = true
    }
  }, [open, customerId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSubmit(true)
    setSubErr(null)

    try {
      const res = await fetch(`/api/admin/customers/${customerId}/sites`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ domain, display_name: display }),
      })
      const data = (await res.json().catch(() => ({}))) as AddResponse

      if (!res.ok || !data.site) {
        setSubErr(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setSites(prev => [...(prev ?? []), data.site!].sort((a, b) =>
        a.domain.localeCompare(b.domain)
      ))
      resetForm()
      router.refresh()
    } catch {
      setSubErr('Network error. Please try again.')
    } finally {
      setSubmit(false)
    }
  }

  const customerLabel = customerName?.trim() || customerEmail

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
      >
        <Globe className="h-3 w-3 text-navy-400" />
        {initialCount}
        <span className="text-navy-400">·</span>
        Manage
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

          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-navy-100 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Admin
                </p>
                <h2 className="mt-1 truncate text-lg font-bold text-navy-900">
                  Manage websites<span className="text-brand-500">.</span>
                </h2>
                <p className="mt-0.5 truncate text-xs text-navy-500">
                  for <span className="text-navy-700">{customerLabel}</span>
                </p>
              </div>
              <button
                onClick={close}
                disabled={submitting}
                className="rounded-full p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              {/* Existing sites */}
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                  Linked websites
                </p>

                {loadingList ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-6 text-xs text-navy-500">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </div>
                ) : loadErr ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {loadErr}
                  </div>
                ) : sites && sites.length > 0 ? (
                  <ul className="space-y-2">
                    {sites.map(s => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy-900">
                            {s.display_name?.trim() || s.domain}
                          </p>
                          {s.display_name?.trim() && (
                            <p className="truncate text-xs text-navy-500">{s.domain}</p>
                          )}
                        </div>
                        <a
                          href={`https://${s.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-navy-100 bg-navy-50/60 px-2.5 py-1 text-[10px] font-semibold text-navy-600 transition hover:border-brand-200 hover:text-brand-700"
                        >
                          Visit
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-5 text-center text-xs text-navy-500">
                    No websites linked yet.
                  </div>
                )}
              </section>

              {/* Add new */}
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                  Link a new domain
                </p>
                <form onSubmit={handleAdd} className="space-y-3">
                  <input
                    ref={firstInputRef}
                    type="text"
                    inputMode="url"
                    required
                    autoComplete="off"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    placeholder="example.com"
                    className="input"
                  />
                  <input
                    type="text"
                    autoComplete="off"
                    value={display}
                    onChange={e => setDisplay(e.target.value)}
                    placeholder="Display name (optional, e.g. Main site)"
                    className="input"
                  />

                  {submitErr && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {submitErr}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {submitting ? 'Adding…' : 'Add domain'}
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <div className="flex justify-end border-t border-navy-100 bg-navy-50/40 px-6 py-3">
              <button
                onClick={close}
                disabled={submitting}
                className="rounded-full border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
              >
                Done
              </button>
            </div>
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
