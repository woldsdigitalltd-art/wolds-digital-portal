'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { DataForm } from '../services/[id]/ServiceEditor'
import type {
  ServiceAuthType,
  ServiceWithAuth,
  SettingsSchema,
  SiteServiceStatus,
} from '@/lib/services/types'

interface Site {
  id:           string
  domain:       string
  display_name: string | null
}

interface SiteServiceListItem {
  id:                   string
  site_id:              string
  service_id:           string
  service_key:          string
  service_name:         string
  service_icon:         string | null
  auth_type_id:         string | null
  auth_type:            string | null
  auth_type_label:      string | null
  credentials:          Record<string, unknown> | null
  status:               SiteServiceStatus
  provider_resource_id: string | null
  last_error:           string | null
  provisioned_at:       string | null
  created_at:           string
  updated_at:           string
}

interface Props {
  customerId:    string
  customerEmail: string
  customerName:  string | null
  initialCount:  number
}

export default function ManageSitesButton({
  customerId,
  customerEmail,
  customerName,
  initialCount,
}: Props) {
  const [open, setOpen]                       = useState(false)
  const [sites, setSites]                     = useState<Site[] | null>(null)
  const [services, setServices]               = useState<ServiceWithAuth[]>([])
  const [linksBySite, setLinksBySite]         = useState<Record<string, SiteServiceListItem[]>>({})
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [pending, setPending]                 = useState<Set<string>>(new Set())
  const [assignment, setAssignment]           = useState<{
    site:    Site
    service: ServiceWithAuth
    existing: SiteServiceListItem | null
  } | null>(null)

  const [domain, setDomain]   = useState('')
  const [display, setDisplay] = useState('')
  const [addingSite, setAddingSite] = useState(false)
  const [addErr, setAddErr]   = useState<string | null>(null)

  const router        = useRouter()
  const firstInputRef = useRef<HTMLInputElement>(null)

  function close() {
    if (addingSite) return
    setOpen(false)
    setTimeout(() => {
      setSites(null)
      setLinksBySite({})
      setServices([])
      setError(null)
      setDomain('')
      setDisplay('')
      setAddErr(null)
    }, 200)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !assignment) close() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => firstInputRef.current?.focus(), 50)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assignment])

  useEffect(() => {
    if (!open) return
    let aborted = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [sitesRes, servicesRes] = await Promise.all([
          fetch(`/api/admin/customers/${customerId}/sites`),
          fetch(`/api/admin/services`),
        ])
        const sitesData    = await sitesRes.json().catch(() => ({})) as {
          sites?: Site[]
          error?: string
        }
        const servicesData = await servicesRes.json().catch(() => ({})) as {
          services?: ServiceWithAuth[]
          error?:    string
        }
        if (aborted) return

        if (!sitesRes.ok)    throw new Error(sitesData.error    ?? 'Could not load sites.')
        if (!servicesRes.ok) throw new Error(servicesData.error ?? 'Could not load services.')

        const sitesArr    = sitesData.sites ?? []
        const servicesArr = (servicesData.services ?? []).filter(s => s.enabled)

        setSites(sitesArr)
        setServices(servicesArr)

        const linkResults = await Promise.all(
          sitesArr.map(async site => {
            const r = await fetch(`/api/admin/sites/${site.id}/services`)
            const d = await r.json().catch(() => ({})) as { links?: SiteServiceListItem[] }
            return [site.id, d.links ?? []] as const
          })
        )
        if (aborted) return

        const next: Record<string, SiteServiceListItem[]> = {}
        for (const [siteId, links] of linkResults) next[siteId] = links
        setLinksBySite(next)
      } catch (err) {
        if (!aborted) setError(err instanceof Error ? err.message : 'Failed to load.')
      } finally {
        if (!aborted) setLoading(false)
      }
    })()

    return () => { aborted = true }
  }, [open, customerId])

  function findLink(siteId: string, serviceId: string): SiteServiceListItem | undefined {
    return (linksBySite[siteId] ?? []).find(l => l.service_id === serviceId)
  }

  /**
   * Remove a live service. Calls the provisioning orchestrator so the
   * external resource (e.g. Better Stack monitor) is torn down first;
   * the orchestrator then sets `status='cancelled'` on the row. If the
   * provider call fails, the row ends up as `status='error'` with a
   * `last_error` message, so we refetch the row to surface it.
   */
  async function removeService(site: Site, link: SiteServiceListItem) {
    const key = `${site.id}:${link.service_id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch('/api/admin/provision-service', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ action: 'deprovision', site_service_id: link.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string }
      if (!res.ok) {
        const fresh = await fetchLink(site.id, link.id)
        if (fresh) {
          setLinksBySite(prev => ({
            ...prev,
            [site.id]: (prev[site.id] ?? []).map(l => (l.id === link.id ? fresh : l)),
          }))
        }
        throw new Error(data.error ?? 'Could not remove service.')
      }
      setLinksBySite(prev => ({
        ...prev,
        [site.id]: (prev[site.id] ?? []).map(l =>
          l.id === link.id
            ? { ...l, status: 'cancelled', last_error: null, provider_resource_id: null }
            : l,
        ),
      }))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => {
        const c = new Set(prev); c.delete(key); return c
      })
    }
  }

  /**
   * Re-run provisioning for a link that's in error/pending state
   * (e.g. provider was down, credentials were wrong, etc.).
   */
  async function retryProvision(site: Site, link: SiteServiceListItem) {
    const key = `${site.id}:${link.service_id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch('/api/admin/provision-service', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ action: 'provision', site_service_id: link.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      const fresh = await fetchLink(site.id, link.id)
      if (fresh) {
        setLinksBySite(prev => ({
          ...prev,
          [site.id]: (prev[site.id] ?? []).map(l => (l.id === link.id ? fresh : l)),
        }))
      }
      if (!res.ok) throw new Error(data.error ?? 'Provisioning failed.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => {
        const c = new Set(prev); c.delete(key); return c
      })
    }
  }

  async function fetchLink(siteId: string, linkId: string): Promise<SiteServiceListItem | null> {
    // The list endpoint already returns the joined view we display, so
    // re-fetching the whole list for one site is the simplest way to
    // pull a single row's latest state.
    const r = await fetch(`/api/admin/sites/${siteId}/services`)
    const d = await r.json().catch(() => ({})) as { links?: SiteServiceListItem[] }
    return (d.links ?? []).find(l => l.id === linkId) ?? null
  }

  function handleAssignmentSaved(siteId: string, updated: SiteServiceListItem) {
    setLinksBySite(prev => {
      const existing = (prev[siteId] ?? [])
      const idx      = existing.findIndex(l => l.id === updated.id)
      const next     = idx >= 0
        ? existing.map((l, i) => (i === idx ? updated : l))
        : [...existing, updated]
      return { ...prev, [siteId]: next }
    })
    router.refresh()
  }

  async function handleAddSite(e: React.FormEvent) {
    e.preventDefault()
    setAddingSite(true)
    setAddErr(null)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/sites`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ domain, display_name: display }),
      })
      const data = (await res.json().catch(() => ({}))) as { site?: Site; error?: string }
      if (!res.ok || !data.site) {
        setAddErr(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      const newSite = data.site
      setSites(prev => [...(prev ?? []), newSite].sort((a, b) => a.domain.localeCompare(b.domain)))
      setLinksBySite(prev => ({ ...prev, [newSite.id]: [] }))
      setDomain('')
      setDisplay('')
      router.refresh()
    } catch {
      setAddErr('Network error. Please try again.')
    } finally {
      setAddingSite(false)
    }
  }

  const customerLabel = customerName?.trim() || customerEmail
  const totalActive   = Object.values(linksBySite)
    .flat()
    .filter(l => l.status === 'active' || l.status === 'pending' || l.status === 'provisioning')
    .length

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
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={close} />

          <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="flex items-start justify-between border-b border-navy-100 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Admin
                </p>
                <h2 className="mt-1 truncate text-lg font-bold text-navy-900">
                  Manage websites &amp; services<span className="text-brand-500">.</span>
                </h2>
                <p className="mt-0.5 truncate text-xs text-navy-500">
                  for <span className="text-navy-700">{customerLabel}</span>
                  {!loading && totalActive > 0 && (
                    <> · <span className="text-navy-700">{totalActive} service{totalActive === 1 ? '' : 's'} active or pending</span></>
                  )}
                </p>
              </div>
              <button
                onClick={close}
                disabled={addingSite}
                className="rounded-full p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="border-b border-red-100 bg-red-50 px-6 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {/* Sites */}
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                  Linked websites
                </p>

                {loading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-6 text-xs text-navy-500">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </div>
                ) : sites && sites.length > 0 ? (
                  <ul className="space-y-3">
                    {sites.map(site => (
                      <SiteRow
                        key={site.id}
                        site={site}
                        services={services}
                        links={linksBySite[site.id] ?? []}
                        pending={pending}
                        onAttachOrEdit={(service, existing) =>
                          setAssignment({ site, service, existing })
                        }
                        onRemove={removeService}
                        onRetry={retryProvision}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-5 text-center text-xs text-navy-500">
                    No websites linked yet.
                  </div>
                )}
              </section>

              {/* Add domain */}
              <section className="border-t border-navy-100 pt-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                  Link a new domain
                </p>
                <form onSubmit={handleAddSite} className="space-y-3">
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
                  {addErr && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {addErr}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="submit"
                      disabled={addingSite}
                      className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
                    >
                      {addingSite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {addingSite ? 'Adding…' : 'Add domain'}
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <div className="flex justify-end border-t border-navy-100 bg-navy-50/40 px-6 py-3">
              <button
                onClick={close}
                disabled={addingSite}
                className="rounded-full border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {assignment && (
        <ServiceAssignmentModal
          site={assignment.site}
          service={assignment.service}
          existing={assignment.existing}
          onClose={() => setAssignment(null)}
          onSaved={updated => {
            handleAssignmentSaved(assignment.site.id, updated)
            setAssignment(null)
          }}
        />
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

/* ──────────────────────────────────────── Site row ───────────────────────────── */

function SiteRow({
  site,
  services,
  links,
  pending,
  onAttachOrEdit,
  onRemove,
  onRetry,
}: {
  site:           Site
  services:       ServiceWithAuth[]
  links:          SiteServiceListItem[]
  pending:        Set<string>
  onAttachOrEdit: (service: ServiceWithAuth, existing: SiteServiceListItem | null) => void
  onRemove:       (site: Site, link: SiteServiceListItem) => Promise<void>
  onRetry:        (site: Site, link: SiteServiceListItem) => Promise<void>
}) {
  return (
    <li className="rounded-xl border border-navy-100 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy-900">
            {site.display_name?.trim() || site.domain}
          </p>
          {site.display_name?.trim() && (
            <p className="truncate text-xs text-navy-500">{site.domain}</p>
          )}
        </div>
        <a
          href={`https://${site.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-navy-100 bg-navy-50/60 px-2.5 py-1 text-[10px] font-semibold text-navy-600 transition hover:border-brand-200 hover:text-brand-700"
        >
          Visit
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {services.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-3 py-2 text-[11px] text-navy-500">
          No service offerings exist yet. Define one in{' '}
          <a href="/admin/services" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Services
          </a>.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {services.map(svc => {
            const link        = links.find(l => l.service_id === svc.id) ?? null
            const isPending   = pending.has(`${site.id}:${svc.id}`)
            const isLive      = link && link.status !== 'cancelled'
            const optionCount = svc.auth_options?.length ?? 0

            return (
              <li
                key={svc.id}
                className="flex flex-col gap-2 rounded-xl border border-navy-100 bg-white px-3 py-2.5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Boxes className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-semibold text-navy-900">{svc.name}</p>
                      {isLive && link && <StatusBadge status={link.status} />}
                      {!isLive && optionCount === 0 && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-200">
                          no auth method
                        </span>
                      )}
                    </div>
                    {isLive && link?.auth_type_label && (
                      <p className="truncate text-[10px] text-navy-500">
                        via <span className="font-semibold text-navy-700">{link.auth_type_label}</span>
                      </p>
                    )}
                    {isLive && link?.provider_resource_id && (
                      <p className="truncate text-[10px] text-navy-400">
                        ID: <code>{link.provider_resource_id}</code>
                      </p>
                    )}
                    {isLive && link?.status === 'error' && link.last_error && (
                      <p className="mt-1 inline-flex items-start gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                        <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                        {link.last_error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {isLive ? (
                    <>
                      {link && (link.status === 'error' || link.status === 'pending') && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => onRetry(site, link)}
                          title="Re-run provisioning"
                          className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          {isPending
                            ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            : <RefreshCw className="h-2.5 w-2.5" />}
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onAttachOrEdit(svc, link)}
                        className="inline-flex items-center gap-1 rounded-full border border-navy-100 bg-white px-2.5 py-1 text-[10px] font-semibold text-navy-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onRemove(site, link)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {isPending
                          ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          : <Trash2 className="h-2.5 w-2.5" />}
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={optionCount === 0}
                      onClick={() => onAttachOrEdit(svc, link)}
                      className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      {link ? 'Re-enable' : 'Add'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

/* ──────────────────────────────────────── Status badge ───────────────────────── */

function StatusBadge({ status }: { status: SiteServiceStatus }) {
  const styles: Record<SiteServiceStatus, { bg: string; text: string; ring: string; label: string }> = {
    active:       { bg: 'bg-brand-50',   text: 'text-brand-700', ring: 'ring-brand-100',  label: 'active'       },
    pending:      { bg: 'bg-amber-50',   text: 'text-amber-700', ring: 'ring-amber-200',  label: 'pending'      },
    provisioning: { bg: 'bg-amber-50',   text: 'text-amber-700', ring: 'ring-amber-200',  label: 'provisioning' },
    error:        { bg: 'bg-red-50',     text: 'text-red-700',   ring: 'ring-red-200',    label: 'error'        },
    suspended:    { bg: 'bg-navy-50',    text: 'text-navy-600',  ring: 'ring-navy-100',   label: 'suspended'    },
    cancelled:    { bg: 'bg-navy-50',    text: 'text-navy-600',  ring: 'ring-navy-100',   label: 'cancelled'    },
  }
  const s = styles[status] ?? styles.cancelled
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.bg} ${s.text} ring-1 ${s.ring}`}>
      {s.label}
    </span>
  )
}

/* ──────────────────────────────────────── Assignment modal ───────────────────────── */

function ServiceAssignmentModal({
  site,
  service,
  existing,
  onSaved,
  onClose,
}: {
  site:       Site
  service:    ServiceWithAuth
  existing:   SiteServiceListItem | null
  onSaved:    (link: SiteServiceListItem) => void
  onClose:    () => void
}) {
  // when editing, the auth method is locked to whatever is in `existing`
  const lockedOption = useMemo<ServiceAuthType | null>(() => {
    if (!existing || !existing.auth_type_id) return null
    return service.auth_options.find(o => o.id === existing.auth_type_id) ?? null
  }, [existing, service])

  const initialOptionId = useMemo(() => {
    if (lockedOption) return lockedOption.id
    const def = service.auth_options.find(o => o.is_default)
    return def?.id ?? service.auth_options[0]?.id ?? ''
  }, [service, lockedOption])

  const [optionId, setOptionId] = useState<string>(initialOptionId)
  const selectedOption = useMemo<ServiceAuthType | null>(
    () => service.auth_options.find(o => o.id === optionId) ?? null,
    [service, optionId]
  )
  const schema: SettingsSchema =
    selectedOption?.settings_schema ?? { fields: [] }

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const start = existing?.credentials ?? {}
    const merged: Record<string, unknown> = { ...start }
    for (const f of schema.fields) {
      if (merged[f.key] === undefined && f.default !== undefined) {
        merged[f.key] = f.default
      }
    }
    return merged
  })

  // Reset values when the user picks a different auth option (only when not editing).
  useEffect(() => {
    if (existing) return
    if (!selectedOption) {
      setValues({})
      return
    }
    const next: Record<string, unknown> = {}
    for (const f of selectedOption.settings_schema?.fields ?? []) {
      if (f.default !== undefined) next[f.key] = f.default
    }
    setValues(next)
  }, [selectedOption, existing])

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function validate(): string | null {
    if (!selectedOption) return 'Pick a connection method to continue.'
    for (const f of schema.fields) {
      if (!f.required) continue
      const v = values[f.key]
      if (v === undefined || v === null || v === '') {
        return `${f.label} is required.`
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); return }

    setSaving(true)
    setError(null)
    try {
      const cleaned: Record<string, unknown> = {}
      for (const f of schema.fields) {
        const raw = values[f.key]
        if (raw === '' || raw === undefined || raw === null) {
          if (f.required) {
            setError(`${f.label} is required.`)
            setSaving(false)
            return
          }
          continue
        }
        cleaned[f.key] = raw
      }

      let res:  Response
      let body: { id?: string; status?: SiteServiceStatus; error?: string; ok?: boolean }

      if (existing) {
        res = await fetch(`/api/admin/sites/${site.id}/services/${existing.id}`, {
          method:  'PATCH',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ credentials: cleaned }),
        })
        body = (await res.json().catch(() => ({}))) as typeof body
        if (!res.ok || !body.ok) throw new Error(body.error ?? 'Save failed.')

        onSaved({
          ...existing,
          credentials: cleaned,
          status:      existing.status === 'cancelled' ? 'active' : existing.status,
          last_error:  null,
        })
      } else {
        // 1. Insert the site_services row (status defaults to
        //    `pending` for provisioning services, `active` otherwise).
        res = await fetch(`/api/admin/sites/${site.id}/services`, {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({
            service_id:   service.id,
            auth_type_id: selectedOption!.id,
            credentials:  cleaned,
          }),
        })
        body = (await res.json().catch(() => ({}))) as typeof body
        if (!res.ok || !body.id) throw new Error(body.error ?? 'Could not attach service.')

        const newLinkId = body.id

        // 2. Trigger provisioning. For non-provisioning services this
        //    just stamps `status='active' + provisioned_at`; for the
        //    others (uptime, ssl, ...) this hits the external API.
        //    Either way we read the live row back to grab the final
        //    status / provider_resource_id / last_error.
        let provErr: string | null = null
        try {
          const provRes = await fetch('/api/admin/provision-service', {
            method:  'POST',
            headers: { 'content-type': 'application/json' },
            body:    JSON.stringify({
              action:          'provision',
              site_service_id: newLinkId,
            }),
          })
          if (!provRes.ok) {
            const provBody = (await provRes.json().catch(() => ({}))) as { error?: string }
            provErr = provBody.error ?? 'Provisioning failed.'
          }
        } catch {
          provErr = 'Provisioning request failed.'
        }

        // 3. Re-read the link so we surface the final server-side
        //    state (provider_resource_id, last_error, etc.).
        const r = await fetch(`/api/admin/sites/${site.id}/services`)
        const d = await r.json().catch(() => ({})) as { links?: SiteServiceListItem[] }
        const fresh = (d.links ?? []).find(l => l.id === newLinkId)

        onSaved(fresh ?? {
          id:                   newLinkId,
          site_id:              site.id,
          service_id:           service.id,
          service_key:          service.key,
          service_name:         service.name,
          service_icon:         service.icon,
          auth_type_id:         selectedOption!.id,
          auth_type:            selectedOption!.auth_type,
          auth_type_label:      selectedOption!.label,
          credentials:          cleaned,
          status:               provErr ? 'error' : 'active',
          provider_resource_id: null,
          last_error:           provErr,
          provisioned_at:       null,
          created_at:           new Date().toISOString(),
          updated_at:           new Date().toISOString(),
        })
        // Modal closes (via onSaved → setAssignment(null)) either way.
        // Errors remain visible on the row as a red status badge + last_error.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
        <div className="flex items-start justify-between border-b border-navy-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              {service.name}
            </p>
            <h3 className="mt-1 text-lg font-bold text-navy-900">
              {existing ? 'Edit' : 'Connect'} service<span className="text-brand-500">.</span>
            </h3>
            <p className="mt-0.5 truncate text-xs text-navy-500">
              for <span className="text-navy-700">{site.display_name?.trim() || site.domain}</span>
            </p>
          </div>
          <button
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="rounded-full p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {service.auth_options.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
              This service has no auth methods configured. Define one in{' '}
              <a href={`/admin/services/${service.id}`} className="font-semibold underline-offset-2 hover:underline">
                Services
              </a>{' '}
              first.
            </p>
          ) : (
            <>
              {/* Auth-method picker (or read-only label when editing) */}
              {lockedOption ? (
                <div className="rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                    Connection method
                  </p>
                  <p className="mt-1 text-sm font-semibold text-navy-900">
                    {lockedOption.label}
                  </p>
                  {lockedOption.description && (
                    <p className="mt-0.5 text-[11px] text-navy-600">{lockedOption.description}</p>
                  )}
                  <p className="mt-1.5 text-[10px] text-navy-400">
                    Auth method is locked once a service is connected. Remove and re-add to switch.
                  </p>
                </div>
              ) : service.auth_options.length === 1 ? null : (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                    Choose a connection method
                  </p>
                  <div className="space-y-1.5">
                    {[...service.auth_options]
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map(opt => {
                        const checked = opt.id === optionId
                        return (
                          <label
                            key={opt.id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                              checked
                                ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200'
                                : 'border-navy-100 bg-white hover:border-brand-200 hover:bg-brand-50/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="auth-option"
                              checked={checked}
                              onChange={() => setOptionId(opt.id)}
                              className="mt-0.5 h-3.5 w-3.5 text-brand-600 focus:ring-brand-500"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-xs font-semibold text-navy-900">{opt.label}</p>
                                {opt.is_default && (
                                  <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-semibold text-brand-800">
                                    default
                                  </span>
                                )}
                              </div>
                              {opt.description && (
                                <p className="mt-0.5 text-[11px] text-navy-600">{opt.description}</p>
                              )}
                            </div>
                            {checked && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                          </label>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Dynamic form */}
              <div className="border-t border-navy-100 pt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                  Settings
                </p>
                <DataForm schema={schema} values={values} onChange={setValues} />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-between gap-2 border-t border-navy-100 bg-navy-50/40 px-6 py-3">
          <p className="text-[10px] text-navy-500">
            {service.provisioning_required ? (
              <>Status will start as <strong>pending</strong>.</>
            ) : (
              <>Status will be set to <strong>active</strong>.</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              disabled={saving}
              className="rounded-full border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
              disabled={saving || service.auth_options.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {existing ? 'Save changes' : 'Connect'}
              {!saving && !existing && <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
