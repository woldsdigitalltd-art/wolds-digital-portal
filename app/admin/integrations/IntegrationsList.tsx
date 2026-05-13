'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Pencil,
  Save,
  ShieldAlert,
} from 'lucide-react'
import {
  MASKED_PASSWORD,
  isReadyToEnable,
  missingRequiredFields,
} from '@/lib/integrations/types'
import type {
  Integration,
  IntegrationField,
  IntegrationFieldType,
} from '@/lib/integrations/types'

/** External dashboards we link out to from the integration card. */
const PROVIDER_URLS: Record<string, string> = {
  betterstack: 'https://betterstack.com',
}

interface Props {
  initialIntegrations: Integration[]
}

export default function IntegrationsList({ initialIntegrations }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations)
  const router = useRouter()

  function replaceIntegration(updated: Integration) {
    setIntegrations(prev => prev.map(i => (i.id === updated.id ? updated : i)))
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {integrations.map(integration => (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          onUpdated={replaceIntegration}
        />
      ))}
    </div>
  )
}

/* ───────────────────────────────── Card ───────────────────────────────────── */

function IntegrationCard({
  integration,
  onUpdated,
}: {
  integration: Integration
  onUpdated:   (i: Integration) => void
}) {
  const [editingFieldKeys, setEditingFieldKeys]   = useState<Set<string>>(new Set())
  const [draftValues,      setDraftValues]        = useState<Record<string, string>>({})
  const [savingFieldKeys,  setSavingFieldKeys]    = useState<Set<string>>(new Set())
  const [togglingEnabled,  setTogglingEnabled]    = useState(false)
  const [error,            setError]              = useState<string | null>(null)
  const [flash,            setFlashMessage]       = useState<string | null>(null)

  const fields = (integration.required_fields ?? []) as IntegrationField[]
  const values = (integration.input_values    ?? {}) as Record<string, string>

  const ready   = isReadyToEnable(integration)
  const missing = useMemo(() => missingRequiredFields(integration), [integration])

  function showFlash(msg: string) {
    setFlashMessage(msg)
    setError(null)
    setTimeout(() => setFlashMessage(null), 2000)
  }

  function startEditing(fieldKey: string, initial: string) {
    setEditingFieldKeys(prev => new Set(prev).add(fieldKey))
    setDraftValues(prev => ({ ...prev, [fieldKey]: initial }))
    setError(null)
  }

  function cancelEditing(fieldKey: string) {
    setEditingFieldKeys(prev => {
      const next = new Set(prev); next.delete(fieldKey); return next
    })
    setDraftValues(prev => {
      const { [fieldKey]: _drop, ...rest } = prev
      void _drop
      return rest
    })
  }

  async function saveField(field: IntegrationField) {
    const value = draftValues[field.key] ?? ''
    if (field.required && !value.trim()) {
      setError(`${field.label} can't be empty.`)
      return
    }

    setSavingFieldKeys(prev => new Set(prev).add(field.key))
    setError(null)

    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}`, {
        method:  'PATCH',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          input_values: { [field.key]: value.trim() },
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        integration?: Integration
        error?:       string
      }
      if (!res.ok || !data.integration) {
        throw new Error(data.error ?? 'Save failed.')
      }

      onUpdated(data.integration)
      cancelEditing(field.key)
      showFlash(`${field.label} saved.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSavingFieldKeys(prev => {
        const next = new Set(prev); next.delete(field.key); return next
      })
    }
  }

  async function toggleEnabled(next: boolean) {
    if (next && !ready) {
      setError(`Fill in: ${missing.join(', ')}`)
      return
    }
    setTogglingEnabled(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}`, {
        method:  'PATCH',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ enabled: next }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        integration?: Integration
        error?:       string
      }
      if (!res.ok || !data.integration) {
        throw new Error(data.error ?? 'Could not update.')
      }
      onUpdated(data.integration)
      showFlash(next ? 'Integration enabled.' : 'Integration disabled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update.')
    } finally {
      setTogglingEnabled(false)
    }
  }

  const providerUrl = PROVIDER_URLS[integration.key]

  return (
    <section className="flex flex-col rounded-2xl border border-navy-100 bg-white shadow-soft">
      <header className="flex items-start justify-between gap-3 border-b border-navy-100 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
            Provider
          </p>
          <h2 className="mt-0.5 text-base font-bold text-navy-900">
            {integration.name}
            <span className="text-brand-500">.</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-navy-500">
            <code className="text-navy-700">{integration.key}</code>
          </p>
        </div>
        {providerUrl && (
          <a
            href={providerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-navy-100 bg-white px-2.5 py-1 text-[10px] font-semibold text-navy-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          >
            Open dashboard
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </header>

      <div className="flex-1 space-y-4 px-5 py-4">
        <EnabledRow
          enabled={integration.enabled}
          ready={ready}
          missing={missing}
          loading={togglingEnabled}
          onChange={toggleEnabled}
        />

        {fields.length > 0 && (
          <div className="space-y-3">
            {fields.map(field => {
              const editing  = editingFieldKeys.has(field.key)
              const saving   = savingFieldKeys.has(field.key)
              const stored   = values[field.key] ?? ''
              const hasValue = stored.trim().length > 0

              return (
                <div
                  key={field.key}
                  className="rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                      {field.label}
                      {field.required && <span className="ml-1 text-brand-600">*</span>}
                    </span>
                    {!editing && hasValue && (
                      <button
                        type="button"
                        onClick={() => startEditing(field.key, field.type === 'password' ? '' : stored)}
                        className="inline-flex items-center gap-1 rounded-full border border-navy-100 bg-white px-2 py-0.5 text-[10px] font-semibold text-navy-600 transition hover:border-brand-200 hover:text-brand-700"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        Update
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <FieldEditor
                      field={field}
                      value={draftValues[field.key] ?? ''}
                      saving={saving}
                      onChange={v => setDraftValues(prev => ({ ...prev, [field.key]: v }))}
                      onCancel={() => cancelEditing(field.key)}
                      onSave={() => saveField(field)}
                    />
                  ) : (
                    <FieldDisplay
                      field={field}
                      value={stored}
                      onAdd={() => startEditing(field.key, '')}
                    />
                  )}

                  {field.help && (
                    <p className="mt-1.5 text-[10px] leading-relaxed text-navy-500">{field.help}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {error}
          </div>
        )}
        {flash && !error && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700">
            <CheckCircle2 className="mr-1 inline h-3 w-3" />
            {flash}
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-navy-100 bg-navy-50/40 px-5 py-2.5 text-[10px] text-navy-500">
        <ShieldAlert className="h-3 w-3 text-navy-400" />
        Saved values stay server-side; passwords are never sent back to the browser.
      </footer>
    </section>
  )
}

/* ──────────────────────────────── Sub-components ─────────────────────────── */

function EnabledRow({
  enabled, ready, missing, loading, onChange,
}: {
  enabled:  boolean
  ready:    boolean
  missing:  string[]
  loading:  boolean
  onChange: (next: boolean) => void
}) {
  const blocked = !ready && !enabled
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${
        enabled
          ? 'border-brand-200 bg-brand-50/60'
          : blocked
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-navy-100 bg-white'
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-navy-900">
          {enabled
            ? 'Enabled platform-wide'
            : blocked
              ? 'Configuration incomplete'
              : 'Disabled platform-wide'}
        </p>
        <p className="text-[11px] text-navy-500">
          {enabled
            ? 'Admins can attach this to sites.'
            : blocked
              ? `Fill in: ${missing.join(', ')}`
              : 'Toggle on to make it available on customer sites.'}
        </p>
      </div>
      <label
        className={`inline-flex shrink-0 items-center gap-2 ${blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        title={blocked ? 'Fill in required fields first.' : undefined}
      >
        <span className="text-[11px] font-semibold text-navy-700">
          {enabled ? 'On' : 'Off'}
        </span>
        <span className="relative inline-flex h-5 w-9 items-center">
          <input
            type="checkbox"
            checked={enabled}
            disabled={loading || blocked}
            onChange={e => onChange(e.target.checked)}
            className="peer absolute inset-0 cursor-pointer appearance-none rounded-full"
          />
          <span className="pointer-events-none absolute inset-0 rounded-full bg-navy-200 transition peer-checked:bg-brand-500 peer-disabled:opacity-50" />
          <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-navy-400" />}
      </label>
    </div>
  )
}

function FieldDisplay({
  field, value, onAdd,
}: {
  field: IntegrationField
  value: string
  onAdd: () => void
}) {
  const hasValue = value.trim().length > 0
  if (!hasValue) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-600 transition hover:border-brand-300 hover:text-brand-700"
      >
        <Pencil className="h-3 w-3" />
        Add {field.label.toLowerCase()}
      </button>
    )
  }
  if (field.type === 'password') {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-sm text-navy-700">
        <Lock className="h-3 w-3 text-navy-400" />
        {MASKED_PASSWORD}
      </p>
    )
  }
  return <p className="mt-1.5 break-all font-mono text-sm text-navy-800">{value}</p>
}

function FieldEditor({
  field, value, saving, onChange, onCancel, onSave,
}: {
  field:    IntegrationField
  value:    string
  saving:   boolean
  onChange: (v: string) => void
  onCancel: () => void
  onSave:   () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = field.type === 'password'

  const inputType: string = isPassword
    ? (revealed ? 'text' : 'password')
    : htmlTypeFor(field.type)

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <div className="relative flex-1">
        <input
          autoFocus
          autoComplete="off"
          type={inputType}
          value={value}
          placeholder={field.placeholder}
          disabled={saving}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onSave() }
            if (e.key === 'Escape') { e.preventDefault(); onCancel() }
          }}
          className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2 pr-10 text-sm text-navy-900 outline-none transition focus:border-brand-400 focus:ring-3 focus:ring-brand-100"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed(r => !r)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
            aria-label={revealed ? 'Hide value' : 'Reveal value'}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
      </div>
    </div>
  )
}

function htmlTypeFor(type: IntegrationFieldType): string {
  switch (type) {
    case 'email':    return 'email'
    case 'url':      return 'url'
    case 'number':   return 'number'
    case 'password': return 'password'
    default:         return 'text'
  }
}
