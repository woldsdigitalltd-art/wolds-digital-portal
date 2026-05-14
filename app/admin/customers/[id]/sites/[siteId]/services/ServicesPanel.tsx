'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ChevronDown,
  Gauge,
  Loader2,
  Plus,
  RefreshCw,
  SearchCheck,
  Trash2,
  Unlink,
} from 'lucide-react'
import type {
  Integration,
  IntegrationStatus,
  ScheduleFrequency,
  SiteIntegration,
} from '@/lib/integrations/types'
import { describeSchedule } from '@/lib/integrations/schedule'

const AUDIT_KEYS = new Set(['seoscoreapi', 'pagespeed', 'brokenlinks'])

export interface SiteIntegrationListItem extends SiteIntegration {
  integration_key:  string
  integration_name: string
}

interface Props {
  siteId:              string
  initialIntegrations: Integration[]
  initialLinks:        SiteIntegrationListItem[]
}

export default function ServicesPanel({ siteId, initialIntegrations, initialLinks }: Props) {
  const router = useRouter()
  const [integrations]              = useState<Integration[]>(initialIntegrations)
  const [links, setLinks]           = useState<SiteIntegrationListItem[]>(initialLinks)
  const [pending, setPending]       = useState<Set<string>>(new Set())
  const [error, setError]           = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [scheduleOpenId, setScheduleOpenId] = useState<string | null>(null)
  const [configModalId, setConfigModalId] = useState<string | null>(null)
  const [configValues, setConfigValues]   = useState<Record<string, string>>({})

  const linkedIds = new Set(links.map(l => l.integration_id))
  const available = integrations.filter(i => !linkedIds.has(i.id))

  async function attach(integrationId: string, inputValues?: Record<string, string>) {
    const key = `attach:${integrationId}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch('/api/admin/site-integrations', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ site_id: siteId, integration_id: integrationId, input_values: inputValues }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        link?:  SiteIntegrationListItem
        error?: string
      }
      if (data.link) setLinks(prev => mergeLink(prev, data.link!))
      if (!res.ok)   throw new Error(data.error ?? 'Could not attach integration.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => { const c = new Set(prev); c.delete(key); return c })
    }
  }

  async function rerun(link: SiteIntegrationListItem) {
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
      if (!res.ok) throw new Error(data.error ?? 'Could not re-run audit.')
      if (data.link) setLinks(prev => mergeLink(prev, data.link!))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => { const c = new Set(prev); c.delete(key); return c })
    }
  }

  async function saveSchedule(
    link: SiteIntegrationListItem,
    payload: {
      schedule_frequency:    ScheduleFrequency
      schedule_hour:         number | null
      schedule_day_of_week:  number | null
      schedule_day_of_month: number | null
    },
  ): Promise<boolean> {
    const key = `schedule:${link.id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch(`/api/admin/site-integrations/${link.id}`, {
        method:  'PATCH',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as {
        link?:  SiteIntegrationListItem
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? 'Could not save schedule.')
      if (data.link) setLinks(prev => mergeLink(prev, data.link!))
      router.refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
      return false
    } finally {
      setPending(prev => { const c = new Set(prev); c.delete(key); return c })
    }
  }

  async function remove(link: SiteIntegrationListItem) {
    if (!confirm(`Remove ${link.integration_name} from this site?`)) return
    const key = `remove:${link.id}`
    setPending(prev => new Set(prev).add(key))
    setError(null)
    try {
      const res = await fetch(`/api/admin/site-integrations/${link.id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not remove integration.')
      setLinks(prev => prev.filter(l => l.id !== link.id))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setPending(prev => { const c = new Set(prev); c.delete(key); return c })
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
          Services
        </p>
        <p className="mt-1 text-sm text-navy-600">
          Attach integrations to this domain. The customer sees a corresponding
          tab in their portal as soon as a service is provisioned.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {links.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 px-4 py-8 text-center text-sm text-navy-500">
          No services attached yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {links.map(link => {
            const removing = pending.has(`remove:${link.id}`)
            const auditing = pending.has(`audit:${link.id}`)
            const isAudit  = AUDIT_KEYS.has(link.integration_key)
            const Icon     = iconForIntegration(link.integration_key)
            return (
              <li
                key={link.id}
                className="rounded-2xl border border-navy-100 bg-white p-4 shadow-soft"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-navy-900">
                        {link.integration_name}
                      </p>
                      <StatusBadge status={link.status} />
                    </div>
                    {link.provider_resource_id && (
                      <p className="mt-0.5 truncate text-[11px] text-navy-400">
                        Monitor ID: <code>{link.provider_resource_id}</code>
                      </p>
                    )}
                    {link.status === 'error' && link.last_error && (
                      <p className="mt-1 inline-flex items-start gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {link.last_error}
                      </p>
                    )}
                    {link.provisioned_at && link.status === 'active' && (
                      <p className="mt-0.5 text-[11px] text-navy-400">
                        Provisioned {new Date(link.provisioned_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {isAudit && (link.status === 'active' || link.status === 'error') && (
                      <button
                        type="button"
                        disabled={auditing || removing}
                        onClick={() => rerun(link)}
                        className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
                      >
                        {auditing
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />}
                        {auditing ? 'Auditing…' : 'Re-run audit'}
                      </button>
                    )}
                    {isAudit && (
                      <button
                        type="button"
                        onClick={() => setScheduleOpenId(prev => prev === link.id ? null : link.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-700 transition hover:bg-navy-50"
                      >
                        <CalendarClock className="h-3 w-3" />
                        Schedule
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={removing || auditing}
                      onClick={() => remove(link)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {removing
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                      Remove
                    </button>
                  </div>
                </div>

                {isAudit && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-navy-500">
                    <CalendarClock className="h-3 w-3" />
                    {describeSchedule({
                      frequency:    link.schedule_frequency,
                      hour:         link.schedule_hour,
                      day_of_week:  link.schedule_day_of_week,
                      day_of_month: link.schedule_day_of_month,
                    })}
                    {link.schedule_next_run_at && (
                      <span className="text-navy-400">
                        · next {new Date(link.schedule_next_run_at).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    )}
                  </p>
                )}

                {isAudit && scheduleOpenId === link.id && (
                  <ScheduleEditor
                    link={link}
                    saving={pending.has(`schedule:${link.id}`)}
                    onCancel={() => setScheduleOpenId(null)}
                    onSave={async payload => {
                      const ok = await saveSchedule(link, payload)
                      if (ok) setScheduleOpenId(null)
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {available.length > 0 ? (
        <div className="relative mt-5">
          <button
            type="button"
            onClick={() => setPickerOpen(p => !p)}
            className="inline-flex w-full items-center justify-between rounded-full border border-dashed border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              Attach a service
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {pickerOpen && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-navy-100 bg-white py-1 shadow-lg">
              {available.map(integration => {
                const attaching = pending.has(`attach:${integration.id}`)
                const needsConfig = ['google_places', 'trustpilot'].includes(integration.key)
                return (
                  <button
                    key={integration.id}
                    type="button"
                    disabled={attaching}
                    onClick={async () => {
                      setPickerOpen(false)
                      if (needsConfig) {
                        setConfigModalId(integration.id)
                        setConfigValues({})
                      } else {
                        await attach(integration.id)
                      }
                    }}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-navy-800 transition hover:bg-brand-50/60 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Boxes className="h-3.5 w-3.5 text-brand-600" />
                      <span className="font-semibold">{integration.name}</span>
                      <span className="text-navy-400">·</span>
                      <code className="text-[11px] text-navy-500">{integration.key}</code>
                    </span>
                    {attaching && <Loader2 className="h-3.5 w-3.5 animate-spin text-navy-400" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        integrations.length === 0 && (
          <p className="mt-5 rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-3 text-xs text-navy-500">
            No integrations configured. Set them up in{' '}
            <a href="/admin/integrations" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
              Integrations
            </a>.
          </p>
        )
      )}

      {configModalId && (
        <ConfigModal
          integrationId={configModalId}
          integration={integrations.find(i => i.id === configModalId)!}
          values={configValues}
          onValuesChange={setConfigValues}
          onConfirm={async () => {
            await attach(configModalId, configValues)
            setConfigModalId(null)
            setConfigValues({})
          }}
          onCancel={() => {
            setConfigModalId(null)
            setConfigValues({})
          }}
          saving={pending.has(`attach:${configModalId}`)}
        />
      )}
    </div>
  )
}

function ScheduleEditor({
  link, saving, onCancel, onSave,
}: {
  link:     SiteIntegrationListItem
  saving:   boolean
  onCancel: () => void
  onSave:   (payload: {
    schedule_frequency:    ScheduleFrequency
    schedule_hour:         number | null
    schedule_day_of_week:  number | null
    schedule_day_of_month: number | null
  }) => Promise<void> | void
}) {
  const [frequency, setFrequency] = useState<ScheduleFrequency>(link.schedule_frequency)
  const [hour,      setHour]      = useState<number>(link.schedule_hour ?? 9)
  const [dow,       setDow]       = useState<number>(link.schedule_day_of_week ?? 1)
  const [dom,       setDom]       = useState<number>(link.schedule_day_of_month ?? 1)

  function handleSave() {
    onSave({
      schedule_frequency:    frequency,
      schedule_hour:         frequency === 'off' ? null : hour,
      schedule_day_of_week:  frequency === 'weekly'  ? dow : null,
      schedule_day_of_month: frequency === 'monthly' ? dom : null,
    })
  }

  return (
    <div className="mt-3 rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Frequency">
          <select
            value={frequency}
            onChange={e => setFrequency(e.target.value as ScheduleFrequency)}
            className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>

        {frequency === 'weekly' && (
          <Field label="Day of week">
            <select
              value={dow}
              onChange={e => setDow(parseInt(e.target.value, 10))}
              className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
            </select>
          </Field>
        )}

        {frequency === 'monthly' && (
          <Field label="Day of month">
            <select
              value={dom}
              onChange={e => setDom(parseInt(e.target.value, 10))}
              className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        )}

        {frequency !== 'off' && (
          <Field label="Time (UTC)">
            <select
              value={hour}
              onChange={e => setHour(parseInt(e.target.value, 10))}
              className="rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 text-xs text-navy-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {Array.from({ length: 24 }, (_, i) => i).map(h => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </Field>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-navy-500">
      {label}
      {children}
    </label>
  )
}

function mergeLink(
  list: SiteIntegrationListItem[],
  incoming: SiteIntegrationListItem,
): SiteIntegrationListItem[] {
  const idx = list.findIndex(l => l.id === incoming.id)
  if (idx >= 0) return list.map((l, i) => (i === idx ? incoming : l))
  return [...list, incoming]
}

function iconForIntegration(key: string) {
  switch (key) {
    case 'seoscoreapi': return SearchCheck
    case 'pagespeed':   return Gauge
    case 'brokenlinks': return Unlink
    default:            return Boxes
  }
}

type PerSiteTextField = {
  type:        'text'
  key:         string
  label:       string
  placeholder: string
  help:        string
}
type PerSiteSelectField = {
  type:    'select'
  key:     string
  label:   string
  options: { value: string; label: string; description: string }[]
  help:    string
}
type PerSiteField = PerSiteTextField | PerSiteSelectField

const MODE_FIELD: PerSiteSelectField = {
  type:  'select',
  key:   'mode',
  label: 'Review tracking mode',
  options: [
    {
      value:       'full',
      label:       'Full integration',
      description: 'Fetches all individual review text, ratings, and reviewer names.',
    },
    {
      value:       'summary',
      label:       'Summary only',
      description: 'Collects the overall rating and total count — no individual review text.',
    },
  ],
  help: 'Summary is lighter on API quota. Full mode enables displaying individual reviews to the customer.',
}

const PER_SITE_FIELDS: Record<string, PerSiteField[]> = {
  google_places: [
    {
      type:        'text',
      key:         'place_id',
      label:       'Google Place ID',
      placeholder: 'ChIJ…',
      help:        'Find it on Google Maps: search for the business, click Share, and copy the Place ID from the URL.',
    },
    MODE_FIELD,
  ],
  trustpilot: [
    {
      type:        'text',
      key:         'domain',
      label:       'Business Domain',
      placeholder: 'example.com',
      help:        'The domain registered with Trustpilot (without https://).',
    },
    MODE_FIELD,
  ],
}

function ConfigModal({
  integration,
  values,
  onValuesChange,
  onConfirm,
  onCancel,
  saving,
}: {
  integrationId:  string
  integration:    Integration
  values:         Record<string, string>
  onValuesChange: (v: Record<string, string>) => void
  onConfirm:      () => Promise<void>
  onCancel:       () => void
  saving:         boolean
}) {
  const fields = PER_SITE_FIELDS[integration.key] ?? []
  const canSubmit = fields.every(f => String(values[f.key] ?? '').trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-6 shadow-xl">
        <p className="text-sm font-semibold text-navy-900">Configure {integration.name}</p>
        <p className="mt-0.5 text-xs text-navy-500">
          These details are stored per-site and used when fetching review data.
        </p>

        <div className="mt-4 space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-navy-500">
                {f.label}
              </label>
              {f.type === 'text' ? (
                <input
                  type="text"
                  value={values[f.key] ?? ''}
                  onChange={e => onValuesChange({ ...values, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  {f.options.map(opt => {
                    const selected = (values[f.key] ?? f.options[0].value) === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onValuesChange({ ...values, [f.key]: opt.value })}
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition ${
                          selected
                            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/30'
                            : 'border-navy-200 bg-white hover:border-navy-300 hover:bg-navy-50/60'
                        }`}
                      >
                        <p className={`text-xs font-semibold ${selected ? 'text-brand-800' : 'text-navy-900'}`}>
                          {opt.label}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-snug text-navy-500">{opt.description}</p>
                      </button>
                    )
                  })}
                </div>
              )}
              {f.help && (
                <p className="mt-1.5 text-[10px] leading-snug text-navy-400">{f.help}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canSubmit}
            onClick={onConfirm}
            className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saving ? 'Attaching…' : 'Attach'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text} ring-1 ${s.ring}`}>
      {status === 'provisioning' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {s.label}
    </span>
  )
}
