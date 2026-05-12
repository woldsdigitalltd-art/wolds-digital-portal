'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type {
  Integration,
  IntegrationStatus,
} from '@/lib/integrations/types'

interface Site {
  id:           string
  domain:       string
  display_name: string | null
}

interface SiteIntegrationListItem {
  id:                   string
  site_id:              string
  integration_id:       string
  integration_key:      string
  integration_name:     string
  integration_icon:     string | null
  integration_provider: string | null
  config:               Record<string, unknown> | null
  status:               IntegrationStatus
  provider_resource_id: string | null
  provider_metadata:    Record<string, unknown> | null
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

const ICON_MAP: Record<string, React.ElementType> = {
  Activity, BarChart3, Boxes, Globe, Megaphone, ShieldCheck, Zap,
}

export default function ManageSitesButton({
  customerId,
  customerEmail,
  customerName,
  initialCount,
}: Props) {
  const [open, setOpen]                 = useState(false)
  const [sites, setSites]               = useState<Site[] | null>(null)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [linksBySite, setLinksBySite]   = useState<Record<string, SiteIntegrationListItem[]>>({})
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [pending, setPending]           = useState<Set<string>>(new Set())

  const [assignment, setAssignment] = useState<{
    site:        Site
    integration: Integration
    existing:    SiteIntegrationListItem | null
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
      setIntegrations([])
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
        const [sitesRes, intsRes] = await Promise.all([
          fetch(`/api/admin/customers/${customerId}/sites`),
          fetch(`/api/admin/integrations`),
        ])
        const sitesData = await sitesRes.json().catch(() => ({})) as {
          sites?: Site[]
          error?: string
        }
        const intsData  = await intsRes.json().catch(() => ({})) as {
          integrations?: Integration[]
          error?:        string
        }
        if (aborted) return

        if (!sitesRes.ok) throw new Error(sitesData.error ?? 'Could not load sites.')
        if (!intsRes.ok)  throw new Error(intsData.error  ?? 'Could not load integrations.')

        const sitesArr = sitesData.sites ?? []
        const intsArr  = (intsData.integrations ?? []).filter(i => i.enabled)

        setSites(sitesArr)
        setIntegrations(intsArr)

        const linkResults = await Promise.all(
          sitesArr.map(async site => {
            const r = await fetch(`/api/admin/sites/${site.id}/integrations`)
            const d = await r.json().catch(() => ({})) as { links?: SiteIntegrationListItem[] }
            return [site.id, d.links ?? []] as const
          }),
        )
        if (aborted) return

        const next: Record<string, SiteIntegrationListItem[]> = {}
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

  async function fetchLink(
    siteId: string,
    linkId: string,
  ): Promise<SiteIntegrationListItem | null> {
    const r = await fetch(`/api/admin/sites/${siteId}/integrations`)
    const d = await r.json().catch(() => ({})) as { links?: SiteIntegrationListItem[] }
    return (d.links ?? []).find(l => l.id === linkId) ?? null
  }

  async function removeIntegration(site: Site, link: SiteIntegrationListItem) {
    const key = `${site.id}:${link.integration_id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch('/api/admin/provision-integration', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          action:              'deprovision',
          site_integration_id: link.id,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        const fresh = await fetchLink(site.id, link.id)
        if (fresh) {
          setLinksBySite(prev => ({
            ...prev,
            [site.id]: (prev[site.id] ?? []).map(l => (l.id === link.id ? fresh : l)),
          }))
        }
        throw new Error(data.error ?? 'Could not remove integration.')
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

  async function retryProvision(site: Site, link: SiteIntegrationListItem) {
    const key = `${site.id}:${link.integration_id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch('/api/admin/provision-integration', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          action:              'provision',
          site_integration_id: link.id,
        }),
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

  function handleAssignmentSaved(siteId: string, updated: SiteIntegrationListItem) {
    setLinksBySite(prev => {
      const existing = prev[siteId] ?? []
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
                  Manage websites &amp; integrations<span className="text-brand-500">.</span>
                </h2>
                <p className="mt-0.5 truncate text-xs text-navy-500">
                  for <span className="text-navy-700">{customerLabel}</span>
                  {!loading && totalActive > 0 && (
                    <> · <span className="text-navy-700">{totalActive} integration{totalActive === 1 ? '' : 's'} live or pending</span></>
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
                        integrations={integrations}
                        links={linksBySite[site.id] ?? []}
                        pending={pending}
                        onAttachOrEdit={(integration, existing) =>
                          setAssignment({ site, integration, existing })
                        }
                        onRemove={removeIntegration}
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
        <IntegrationAssignmentModal
          site={assignment.site}
          integration={assignment.integration}
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
  integrations,
  links,
  pending,
  onAttachOrEdit,
  onRemove,
  onRetry,
}: {
  site:           Site
  integrations:   Integration[]
  links:          SiteIntegrationListItem[]
  pending:        Set<string>
  onAttachOrEdit: (integration: Integration, existing: SiteIntegrationListItem | null) => void
  onRemove:       (site: Site, link: SiteIntegrationListItem) => Promise<void>
  onRetry:        (site: Site, link: SiteIntegrationListItem) => Promise<void>
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

      {integrations.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-3 py-2 text-[11px] text-navy-500">
          No integrations defined. Add one in{' '}
          <a href="/admin/integrations" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Integrations
          </a>.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {integrations.map(integration => {
            const link      = links.find(l => l.integration_id === integration.id) ?? null
            const isPending = pending.has(`${site.id}:${integration.id}`)
            const isLive    = link && link.status !== 'cancelled'
            const Icon      = (integration.icon && ICON_MAP[integration.icon]) || Boxes

            return (
              <li
                key={integration.id}
                className="flex flex-col gap-2 rounded-xl border border-navy-100 bg-white px-3 py-2.5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-semibold text-navy-900">{integration.name}</p>
                      {isLive && link && <StatusBadge status={link.status} />}
                    </div>
                    {isLive && link?.provider_resource_id && (
                      <p className="truncate text-[10px] text-navy-400">
                        {link.integration_provider === 'betterstack' ? 'Monitor' : 'Resource'} ID:{' '}
                        <code>{link.provider_resource_id}</code>
                      </p>
                    )}
                    {isLive && link?.status === 'error' && link.last_error && (
                      <p className="mt-1 inline-flex items-start gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                        <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                        {link.last_error}
                      </p>
                    )}
                    {isLive && link?.provisioned_at && link.status === 'active' && (
                      <p className="text-[10px] text-navy-400">
                        Provisioned {new Date(link.provisioned_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
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
                      {hasConfigFields(integration.key) && (
                        <button
                          type="button"
                          onClick={() => onAttachOrEdit(integration, link)}
                          className="inline-flex items-center gap-1 rounded-full border border-navy-100 bg-white px-2.5 py-1 text-[10px] font-semibold text-navy-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          Edit
                        </button>
                      )}
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
                      onClick={() => onAttachOrEdit(integration, link)}
                      className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-navy-800"
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

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const styles: Record<IntegrationStatus, { bg: string; text: string; ring: string; label: string }> = {
    active:       { bg: 'bg-brand-50', text: 'text-brand-700', ring: 'ring-brand-100', label: 'Active'        },
    pending:      { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Pending'       },
    provisioning: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Provisioning…' },
    error:        { bg: 'bg-red-50',   text: 'text-red-700',   ring: 'ring-red-200',   label: 'Error'         },
    suspended:    { bg: 'bg-navy-50',  text: 'text-navy-600',  ring: 'ring-navy-100',  label: 'Suspended'     },
    cancelled:    { bg: 'bg-navy-50',  text: 'text-navy-600',  ring: 'ring-navy-100',  label: 'Cancelled'     },
  }
  const s = styles[status] ?? styles.cancelled
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.bg} ${s.text} ring-1 ${s.ring}`}>
      {status === 'provisioning' && <Loader2 className="h-2 w-2 animate-spin" />}
      {s.label}
    </span>
  )
}

/* ──────────────────────────────────────── Assignment modal ───────────────────────── */

/** Does this integration key actually need any per-site form fields? */
function hasConfigFields(key: string): boolean {
  return key === 'analytics' || key === 'whats_on'
}

function IntegrationAssignmentModal({
  site,
  integration,
  existing,
  onSaved,
  onClose,
}: {
  site:        Site
  integration: Integration
  existing:    SiteIntegrationListItem | null
  onSaved:     (link: SiteIntegrationListItem) => void
  onClose:     () => void
}) {
  // Analytics provider sub-picker (GA4 vs Plausible)
  type AnalyticsProvider = 'ga4' | 'plausible'
  const existingProvider: AnalyticsProvider | null =
    (existing?.config?.provider as AnalyticsProvider | undefined) ?? null

  const [analyticsProvider, setAnalyticsProvider] = useState<AnalyticsProvider>(
    existingProvider ?? 'ga4',
  )
  const [propertyId, setPropertyId] = useState<string>(
    (existing?.config?.property_id as string | undefined) ?? '',
  )
  const [plausibleDomain, setPlausibleDomain] = useState<string>(
    (existing?.config?.domain as string | undefined) ?? '',
  )
  const [organizationId, setOrganizationId] = useState<string>(
    (existing?.config?.organization_id as string | undefined) ?? '',
  )

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  /** Build the `config` JSON object to send to the API. */
  const config = useMemo<Record<string, unknown>>(() => {
    switch (integration.key) {
      case 'analytics':
        if (analyticsProvider === 'ga4') {
          return { provider: 'ga4', property_id: propertyId.trim() }
        }
        return { provider: 'plausible', domain: plausibleDomain.trim() }
      case 'whats_on': {
        const t = organizationId.trim()
        return t ? { organization_id: t } : {}
      }
      case 'uptime':
      case 'ssl':
      default:
        return {}
    }
  }, [integration.key, analyticsProvider, propertyId, plausibleDomain, organizationId])

  function validate(): string | null {
    if (integration.key === 'analytics') {
      if (analyticsProvider === 'ga4' && !propertyId.trim()) {
        return 'Measurement ID is required.'
      }
      if (analyticsProvider === 'plausible' && !plausibleDomain.trim()) {
        return 'Plausible domain is required.'
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
      if (existing) {
        // Edit: just update config; no re-provision (analytics/whats_on
        // don't have external resources).
        const res = await fetch(
          `/api/admin/sites/${site.id}/integrations/${existing.id}`,
          {
            method:  'PATCH',
            headers: { 'content-type': 'application/json' },
            body:    JSON.stringify({ config }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'Save failed.')

        onSaved({
          ...existing,
          config,
          status:     existing.status === 'cancelled' ? 'active' : existing.status,
          last_error: null,
        })
        return
      }

      // Create + provision
      const insertRes = await fetch(`/api/admin/sites/${site.id}/integrations`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          integration_id: integration.id,
          config,
        }),
      })
      const insertBody = (await insertRes.json().catch(() => ({}))) as {
        id?: string; status?: IntegrationStatus; error?: string
      }
      if (!insertRes.ok || !insertBody.id) {
        throw new Error(insertBody.error ?? 'Could not attach integration.')
      }
      const newLinkId = insertBody.id

      let provErr: string | null = null
      try {
        const provRes = await fetch('/api/admin/provision-integration', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({
            action:              'provision',
            site_integration_id: newLinkId,
          }),
        })
        if (!provRes.ok) {
          const provBody = (await provRes.json().catch(() => ({}))) as { error?: string }
          provErr = provBody.error ?? 'Provisioning failed.'
        }
      } catch {
        provErr = 'Provisioning request failed.'
      }

      const r = await fetch(`/api/admin/sites/${site.id}/integrations`)
      const d = await r.json().catch(() => ({})) as { links?: SiteIntegrationListItem[] }
      const fresh = (d.links ?? []).find(l => l.id === newLinkId)

      onSaved(fresh ?? {
        id:                   newLinkId,
        site_id:              site.id,
        integration_id:       integration.id,
        integration_key:      integration.key,
        integration_name:     integration.name,
        integration_icon:     integration.icon,
        integration_provider: integration.provider,
        config,
        status:               provErr ? 'error' : 'active',
        provider_resource_id: null,
        provider_metadata:    null,
        last_error:           provErr,
        provisioned_at:       null,
        created_at:           new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
        <div className="flex items-start justify-between border-b border-navy-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              {integration.name}
            </p>
            <h3 className="mt-1 text-lg font-bold text-navy-900">
              {existing ? 'Edit' : 'Add'} integration<span className="text-brand-500">.</span>
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
          {/* Per-integration body */}
          {integration.key === 'uptime' || integration.key === 'ssl' ? (
            <p className="rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-3 text-xs text-navy-600">
              No configuration needed — the monitor will use{' '}
              <code className="text-navy-800">{site.domain}</code> automatically.
            </p>
          ) : integration.key === 'analytics' ? (
            <>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                  Provider
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['ga4', 'plausible'] as const).map(p => {
                    const label = p === 'ga4' ? 'Google Analytics 4' : 'Plausible Analytics'
                    const checked = analyticsProvider === p
                    return (
                      <label
                        key={p}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
                          checked
                            ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200'
                            : 'border-navy-100 bg-white hover:border-brand-200 hover:bg-brand-50/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="analytics-provider"
                          checked={checked}
                          onChange={() => setAnalyticsProvider(p)}
                          className="h-3.5 w-3.5 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="flex-1 text-xs font-semibold text-navy-900">{label}</span>
                        {checked && <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />}
                      </label>
                    )
                  })}
                </div>
              </div>

              {analyticsProvider === 'ga4' ? (
                <Field label="Measurement ID" required>
                  <input
                    type="text"
                    required
                    value={propertyId}
                    onChange={e => setPropertyId(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="input font-mono text-sm"
                  />
                </Field>
              ) : (
                <Field label="Domain" required hint="As registered in your Plausible account.">
                  <input
                    type="text"
                    required
                    value={plausibleDomain}
                    onChange={e => setPlausibleDomain(e.target.value)}
                    placeholder="yourdomain.com"
                    className="input font-mono text-sm"
                  />
                </Field>
              )}
            </>
          ) : integration.key === 'whats_on' ? (
            <Field
              label="Buffer organisation ID"
              hint="Leave blank if you only have one Buffer organisation."
            >
              <input
                type="text"
                value={organizationId}
                onChange={e => setOrganizationId(e.target.value)}
                placeholder="optional"
                className="input font-mono text-sm"
              />
            </Field>
          ) : (
            <p className="rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-3 text-xs text-navy-600">
              No configuration needed for this integration.
            </p>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-between gap-2 border-t border-navy-100 bg-navy-50/40 px-6 py-3">
          <p className="text-[10px] text-navy-500">
            {integration.provisioning_required ? (
              <>External resource will be created.</>
            ) : (
              <>Will be marked <strong>active</strong> immediately.</>
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
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {existing ? 'Save changes' : 'Add & provision'}
            </button>
          </div>
        </div>

        <style jsx>{`
          .input {
            width: 100%;
            border-radius: 0.75rem;
            border: 1px solid #dde7f2;
            background: #fff;
            padding: 0.625rem 0.875rem;
            font-size: 0.875rem;
            color: #0b2545;
          }
          .input::placeholder { color: #94a8c0; }
          .input:focus {
            outline: none;
            border-color: #7ca653;
            box-shadow: 0 0 0 3px rgba(124, 166, 83, 0.15);
          }
        `}</style>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label:     string
  required?: boolean
  hint?:     string
  children:  React.ReactNode
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
