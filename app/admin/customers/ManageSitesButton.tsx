'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Boxes,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Save,
  Settings2,
  Shield,
  X,
} from 'lucide-react'
import { DataForm } from '../services/[id]/ServiceEditor'
import type { ServiceSchema } from '@/lib/services/types'

interface Site {
  id:           string
  domain:       string
  display_name: string | null
}

interface Service {
  id:                   string
  key:                  string
  name:                 string
  description:          string | null
  icon:                 string | null
  has_user_settings:    boolean
  user_settings_schema: ServiceSchema | null
}

interface SiteServiceLink {
  id:                 string
  site_id:            string
  service_id:         string
  service_key:        string
  service_name:       string
  enabled:            boolean
  has_user_settings:  boolean
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
  const [open, setOpen]       = useState(false)
  const [sites, setSites]     = useState<Site[] | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [linksBySite, setLinksBySite] = useState<Record<string, SiteServiceLink[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // For the "add domain" form
  const [domain, setDomain]   = useState('')
  const [display, setDisplay] = useState('')
  const [addingSite, setAddingSite] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

  // For per-link toggles in flight
  const [pending, setPending] = useState<Set<string>>(new Set())

  // For the configure-user-settings modal-within-modal
  const [configFor, setConfigFor] = useState<{
    site: Site
    service: Service
    linkId: string | null
  } | null>(null)

  const router = useRouter()
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !configFor) close() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => firstInputRef.current?.focus(), 50)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, configFor])

  // Load everything: this customer's sites, the catalog, and all
  // existing site_services links.
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
        const sitesData    = await sitesRes.json().catch(() => ({})) as { sites?: Site[]; error?: string }
        const servicesData = await servicesRes.json().catch(() => ({})) as {
          services?: Array<{
            id: string; key: string; name: string; description: string | null;
            icon: string | null; has_user_settings: boolean; enabled: boolean
          }>;
          error?: string
        }
        if (aborted) return

        if (!sitesRes.ok) throw new Error(sitesData.error ?? 'Could not load sites.')
        if (!servicesRes.ok) throw new Error(servicesData.error ?? 'Could not load services.')

        const sitesArr = sitesData.sites ?? []
        const servicesArr: Service[] = (servicesData.services ?? [])
          .filter(s => s.enabled)
          .map(s => ({
            id: s.id, key: s.key, name: s.name, description: s.description, icon: s.icon,
            has_user_settings: s.has_user_settings,
            user_settings_schema: null,
          }))

        setSites(sitesArr)
        setServices(servicesArr)

        // For each site, fetch its current links in parallel.
        const linkResults = await Promise.all(
          sitesArr.map(async site => {
            const res = await fetch(`/api/admin/sites/${site.id}/services`)
            const data = await res.json().catch(() => ({})) as { links?: SiteServiceLink[] }
            return [site.id, data.links ?? []] as const
          })
        )
        if (aborted) return

        const next: Record<string, SiteServiceLink[]> = {}
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

  function findLink(siteId: string, serviceId: string): SiteServiceLink | undefined {
    return (linksBySite[siteId] ?? []).find(l => l.service_id === serviceId)
  }

  async function toggleService(site: Site, service: Service, next: boolean) {
    const key = `${site.id}:${service.id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)

    try {
      if (next) {
        // Attach
        const res = await fetch(`/api/admin/sites/${site.id}/services`, {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ service_id: service.id }),
        })
        const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
        if (!res.ok || !data.id) throw new Error(data.error ?? 'Could not attach service.')
        setLinksBySite(prev => ({
          ...prev,
          [site.id]: [
            ...(prev[site.id] ?? []),
            {
              id: data.id!,
              site_id: site.id,
              service_id: service.id,
              service_key: service.key,
              service_name: service.name,
              enabled: true,
              has_user_settings: false,
            },
          ],
        }))
      } else {
        // Detach
        const link = findLink(site.id, service.id)
        if (!link) return
        const res = await fetch(`/api/admin/sites/${site.id}/services/${link.id}`, {
          method: 'DELETE',
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not detach service.')
        setLinksBySite(prev => ({
          ...prev,
          [site.id]: (prev[site.id] ?? []).filter(l => l.service_id !== service.id),
        }))
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => {
        const copy = new Set(prev)
        copy.delete(key)
        return copy
      })
    }
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
      const newSite: Site = data.site
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
  const totalLinks = Object.values(linksBySite).reduce((s, arr) => s + arr.length, 0)

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

          <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="flex items-start justify-between border-b border-navy-100 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Admin
                </p>
                <h2 className="mt-1 truncate text-lg font-bold text-navy-900">
                  Manage websites & services<span className="text-brand-500">.</span>
                </h2>
                <p className="mt-0.5 truncate text-xs text-navy-500">
                  for <span className="text-navy-700">{customerLabel}</span>
                  {!loading && totalLinks > 0 && (
                    <> · <span className="text-navy-700">{totalLinks} service{totalLinks === 1 ? '' : 's'} attached</span></>
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
                      <li key={site.id} className="rounded-xl border border-navy-100 bg-white p-3">
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
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {services.map(svc => {
                              const link = findLink(site.id, svc.id)
                              const isOn = Boolean(link)
                              const isPending = pending.has(`${site.id}:${svc.id}`)
                              return (
                                <div
                                  key={svc.id}
                                  className="inline-flex items-center overflow-hidden rounded-full border border-navy-100 bg-white text-[11px] font-semibold shadow-sm"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleService(site, svc, !isOn)}
                                    disabled={isPending}
                                    aria-pressed={isOn}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 transition ${
                                      isOn
                                        ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                                        : 'text-navy-600 hover:bg-navy-50'
                                    } disabled:cursor-not-allowed disabled:opacity-70`}
                                  >
                                    <Boxes className={`h-3 w-3 ${isOn ? 'text-brand-600' : 'text-navy-400'}`} />
                                    {svc.name}
                                    {isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin text-navy-400" />
                                    ) : (
                                      <span className={`h-1.5 w-1.5 rounded-full ${isOn ? 'bg-brand-500' : 'bg-navy-300'}`} />
                                    )}
                                  </button>
                                  {isOn && svc.has_user_settings && link && (
                                    <button
                                      type="button"
                                      onClick={() => setConfigFor({ site, service: svc, linkId: link.id })}
                                      className="border-l border-navy-100 bg-white/50 px-2 py-1 text-navy-500 transition hover:bg-brand-50 hover:text-brand-700"
                                      title="Configure user settings"
                                    >
                                      <Settings2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </li>
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

      {/* Per-link user-settings modal */}
      {configFor && configFor.linkId && (
        <UserSettingsModal
          site={configFor.site}
          service={configFor.service}
          linkId={configFor.linkId}
          onClose={(saved) => {
            if (saved) {
              setLinksBySite(prev => ({
                ...prev,
                [configFor.site.id]: (prev[configFor.site.id] ?? []).map(l =>
                  l.id === configFor.linkId ? { ...l, has_user_settings: true } : l
                ),
              }))
              router.refresh()
            }
            setConfigFor(null)
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

/* ──────────────────────────────────────── Settings sub-modal ─────────────────────────── */

function UserSettingsModal({
  site,
  service,
  linkId,
  onClose,
}: {
  site:    Site
  service: Service
  linkId:  string
  onClose: (saved: boolean) => void
}) {
  const [schema, setSchema] = useState<ServiceSchema | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let aborted = false
    setLoading(true)
    fetch(`/api/admin/sites/${site.id}/services/${linkId}`)
      .then(async r => {
        const data = (await r.json().catch(() => ({}))) as {
          link?: {
            user_settings_schema: ServiceSchema | null
            user_settings_data:   Record<string, unknown> | null
          }
          decrypt_error?: string | null
          error?: string
        }
        if (aborted) return
        if (!r.ok || !data.link) {
          setError(data.error ?? 'Could not load settings.')
          return
        }
        setSchema(data.link.user_settings_schema)
        setValues(data.link.user_settings_data ?? {})
        if (data.decrypt_error) setError(`Decryption issue: ${data.decrypt_error}`)
      })
      .catch(() => { if (!aborted) setError('Network error.') })
      .finally(() => { if (!aborted) setLoading(false) })
    return () => { aborted = true }
  }, [site.id, linkId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sites/${site.id}/services/${linkId}`, {
        method:  'PATCH',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ user_settings_data: values }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Save failed.')
        return
      }
      onClose(true)
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
        <div className="flex items-start justify-between border-b border-navy-100 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              {service.name}
            </p>
            <h3 className="mt-1 text-lg font-bold text-navy-900">
              User settings<span className="text-brand-500">.</span>
            </h3>
            <p className="mt-0.5 truncate text-xs text-navy-500">
              for <span className="text-navy-700">{site.display_name?.trim() || site.domain}</span>
            </p>
          </div>
          <button
            onClick={() => onClose(false)}
            disabled={saving}
            className="rounded-full p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-navy-500">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Loading current values…
            </div>
          ) : !schema || schema.fields.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-3 py-4 text-center text-xs text-navy-500">
              This service has no user-level fields defined.
            </p>
          ) : (
            <>
              <div className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-700">
                <Shield className="h-3 w-3" />
                Encrypted at rest
              </div>
              <DataForm schema={schema} values={values} onChange={setValues} />
            </>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 border-t border-navy-100 bg-navy-50/40 px-6 py-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            disabled={saving}
            className="rounded-full border border-navy-200 bg-white px-4 py-2 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            disabled={saving || loading || !schema || schema.fields.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save settings
          </button>
        </div>
      </div>
    </div>
  )
}
