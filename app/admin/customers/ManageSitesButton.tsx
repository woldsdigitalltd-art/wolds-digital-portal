'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ExternalLink,
  Gauge,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  SearchCheck,
  Trash2,
  Unlink,
  X,
} from 'lucide-react'
import type {
  Integration,
  IntegrationStatus,
  SiteIntegration,
} from '@/lib/integrations/types'
import type { SeoAuditResult }     from '@/lib/integrations/seo-audit'
import type { PageSpeedResult }    from '@/lib/integrations/page-speed'
import type { BrokenLinksResult }  from '@/lib/integrations/broken-links'
import {
  BrokenLinksPanel,
  PageSpeedPanel,
  SeoAuditPanel,
} from './AuditPanels'

const AUDIT_KEYS = new Set(['seoscoreapi', 'pagespeed', 'brokenlinks'])

interface Site {
  id:           string
  domain:       string
  display_name: string | null
}

interface SiteIntegrationListItem extends SiteIntegration {
  integration_key:  string
  integration_name: string
}

interface Props {
  customerId:    string
  customerEmail: string
  customerName:  string | null
  initialCount:  number
}

export default function ManageSitesButton({
  customerId, customerEmail, customerName, initialCount,
}: Props) {
  const [open, setOpen]                 = useState(false)
  const [sites, setSites]               = useState<Site[] | null>(null)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [linksBySite, setLinksBySite]   = useState<Record<string, SiteIntegrationListItem[]>>({})
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [pending, setPending]           = useState<Set<string>>(new Set())

  const [domain,   setDomain]    = useState('')
  const [display,  setDisplay]   = useState('')
  const [addingSite, setAddingSite] = useState(false)
  const [addErr,   setAddErr]    = useState<string | null>(null)

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => firstInputRef.current?.focus(), 50)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    let aborted = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [sitesRes, intsRes] = await Promise.all([
          fetch(`/api/admin/customers/${customerId}/sites`),
          fetch('/api/admin/integrations'),
        ])
        const sitesData = await sitesRes.json().catch(() => ({})) as {
          sites?: Site[]; error?: string
        }
        const intsData  = await intsRes.json().catch(() => ({})) as {
          integrations?: Integration[]; error?: string
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
            const r = await fetch(`/api/admin/site-integrations?site_id=${site.id}`)
            const d = await r.json().catch(() => ({})) as {
              links?: SiteIntegrationListItem[]
            }
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

  async function attachIntegration(site: Site, integrationId: string) {
    const key = `attach:${site.id}:${integrationId}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch('/api/admin/site-integrations', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ site_id: site.id, integration_id: integrationId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        link?:  SiteIntegrationListItem
        error?: string
      }
      if (!res.ok) {
        // Fall through: surface the error AND merge whatever the
        // server returned (e.g. the row in 'error' state).
        if (data.link) {
          setLinksBySite(prev => ({
            ...prev,
            [site.id]: mergeLink(prev[site.id] ?? [], data.link!),
          }))
        }
        throw new Error(data.error ?? 'Could not attach integration.')
      }
      if (data.link) {
        setLinksBySite(prev => ({
          ...prev,
          [site.id]: mergeLink(prev[site.id] ?? [], data.link!),
        }))
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => { const c = new Set(prev); c.delete(key); return c })
    }
  }

  async function rerunAudit(site: Site, link: SiteIntegrationListItem) {
    const key = `audit:${link.id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch('/api/admin/run-audit', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ site_integration_id: link.id }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        link?:  SiteIntegrationListItem
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not re-run audit.')
      }
      if (data.link) {
        setLinksBySite(prev => ({
          ...prev,
          [site.id]: mergeLink(prev[site.id] ?? [], data.link!),
        }))
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => { const c = new Set(prev); c.delete(key); return c })
    }
  }

  async function removeIntegration(site: Site, link: SiteIntegrationListItem) {
    if (!confirm(`Remove ${link.integration_name} from ${site.display_name?.trim() || site.domain}?`)) {
      return
    }
    const key = `remove:${link.id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch(`/api/admin/site-integrations/${link.id}`, {
        method: 'DELETE',
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not remove integration.')

      setLinksBySite(prev => ({
        ...prev,
        [site.id]: (prev[site.id] ?? []).filter(l => l.id !== link.id),
      }))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => { const c = new Set(prev); c.delete(key); return c })
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
                    <> · <span className="text-navy-700">
                      {totalActive} integration{totalActive === 1 ? '' : 's'} live or pending
                    </span></>
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
                <AlertTriangle className="mr-1 inline h-3 w-3" />
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
                        onAttach={integrationId => attachIntegration(site, integrationId)}
                        onRemove={link => removeIntegration(site, link)}
                        onRerunAudit={link => rerunAudit(site, link)}
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
                    placeholder="Display name (optional)"
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

/* ─────────────────────────────────── Site row ────────────────────────────── */

function SiteRow({
  site, integrations, links, pending, onAttach, onRemove, onRerunAudit,
}: {
  site:         Site
  integrations: Integration[]
  links:        SiteIntegrationListItem[]
  pending:      Set<string>
  onAttach:     (integrationId: string) => Promise<void>
  onRemove:     (link: SiteIntegrationListItem) => Promise<void>
  onRerunAudit: (link: SiteIntegrationListItem) => Promise<void>
}) {
  const linkedIds   = new Set(links.map(l => l.integration_id))
  const available   = integrations.filter(i => !linkedIds.has(i.id))
  const [pickerOpen, setPickerOpen] = useState(false)

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

      {links.length === 0 && available.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-3 py-2 text-[11px] text-navy-500">
          No integrations available. Configure one in{' '}
          <a href="/admin/integrations" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Integrations
          </a>.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {links.map(link => {
            const removing  = pending.has(`remove:${link.id}`)
            const auditing  = pending.has(`audit:${link.id}`)
            const isAudit   = AUDIT_KEYS.has(link.integration_key)
            const meta      = link.provider_metadata as Record<string, unknown> | null
            const Icon      = iconForIntegration(link.integration_key)
            return (
              <li
                key={link.id}
                className="rounded-xl border border-navy-100 bg-white px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-semibold text-navy-900">{link.integration_name}</p>
                      <StatusBadge status={link.status} />
                    </div>
                    {link.provider_resource_id && (
                      <p className="truncate text-[10px] text-navy-400">
                        Monitor ID: <code>{link.provider_resource_id}</code>
                      </p>
                    )}
                    {link.status === 'error' && link.last_error && (
                      <p className="mt-1 inline-flex items-start gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                        <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                        {link.last_error}
                      </p>
                    )}
                    {link.provisioned_at && link.status === 'active' && (
                      <p className="text-[10px] text-navy-400">
                        Provisioned {new Date(link.provisioned_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {isAudit && (link.status === 'active' || link.status === 'error') && (
                      <button
                        type="button"
                        disabled={auditing || removing}
                        onClick={() => onRerunAudit(link)}
                        className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
                      >
                        {auditing
                          ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          : <RefreshCw className="h-2.5 w-2.5" />}
                        {auditing ? 'Auditing…' : 'Re-run audit'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={removing || auditing}
                      onClick={() => onRemove(link)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {removing
                        ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        : <Trash2 className="h-2.5 w-2.5" />}
                      Remove
                    </button>
                  </div>
                </div>

                {meta && link.integration_key === 'seoscoreapi' && (
                  <SeoAuditPanel audit={meta as unknown as SeoAuditResult} />
                )}
                {meta && link.integration_key === 'pagespeed' && (
                  <PageSpeedPanel report={meta as unknown as PageSpeedResult} />
                )}
                {meta && link.integration_key === 'brokenlinks' && (
                  <BrokenLinksPanel report={meta as unknown as BrokenLinksResult} />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {available.length > 0 && (
        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setPickerOpen(p => !p)}
            className="inline-flex w-full items-center justify-between rounded-full border border-dashed border-navy-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-3 w-3" />
              Add integration
            </span>
            <ChevronDown className={`h-3 w-3 transition ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {pickerOpen && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-navy-100 bg-white py-1 shadow-lg">
              {available.map(integration => {
                const attaching = pending.has(`attach:${site.id}:${integration.id}`)
                return (
                  <button
                    key={integration.id}
                    type="button"
                    disabled={attaching}
                    onClick={async () => {
                      setPickerOpen(false)
                      await onAttach(integration.id)
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-navy-800 transition hover:bg-brand-50/60 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Boxes className="h-3 w-3 text-brand-600" />
                      <span className="font-semibold">{integration.name}</span>
                      <span className="text-navy-400">·</span>
                      <code className="text-[10px] text-navy-500">{integration.key}</code>
                    </span>
                    {attaching && <Loader2 className="h-3 w-3 animate-spin text-navy-400" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function mergeLink(
  list: SiteIntegrationListItem[],
  incoming: SiteIntegrationListItem,
): SiteIntegrationListItem[] {
  const idx = list.findIndex(l => l.id === incoming.id)
  if (idx >= 0) {
    return list.map((l, i) => (i === idx ? incoming : l))
  }
  return [...list, incoming]
}

/* ─────────────────────────────── Integration icon ───────────────────────── */

function iconForIntegration(key: string) {
  switch (key) {
    case 'seoscoreapi': return SearchCheck
    case 'pagespeed':   return Gauge
    case 'brokenlinks': return Unlink
    default:            return Boxes
  }
}

/* ─────────────────────────────── Status badge ────────────────────────────── */

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const styles: Record<IntegrationStatus, { bg: string; text: string; ring: string; label: string }> = {
    active:       { bg: 'bg-brand-50', text: 'text-brand-700', ring: 'ring-brand-100', label: 'Active'        },
    pending:      { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Pending'       },
    provisioning: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Provisioning…' },
    error:        { bg: 'bg-red-50',   text: 'text-red-700',   ring: 'ring-red-200',   label: 'Error'         },
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
