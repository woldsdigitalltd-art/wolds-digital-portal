'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  AlertTriangle,
  Boxes,
  Eraser,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Settings2,
  Shield,
  Trash2,
  X,
} from 'lucide-react'
import type {
  FieldType,
  ServiceDetail,
  ServiceField,
  ServiceSchema,
} from '@/lib/services/types'

const TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text',     label: 'Text' },
  { value: 'password', label: 'Password (masked)' },
  { value: 'url',      label: 'URL' },
  { value: 'email',    label: 'Email' },
  { value: 'number',   label: 'Number' },
  { value: 'boolean',  label: 'Checkbox (boolean)' },
  { value: 'textarea', label: 'Long text' },
]

export default function ServiceEditor({
  initialService,
  decryptError,
}: {
  initialService: ServiceDetail
  decryptError:   string | null
}) {
  const router = useRouter()

  const [service, setService]   = useState<ServiceDetail>(initialService)
  const [savingBasic, setSB]    = useState(false)
  const [savingGlobal, setSG]   = useState(false)
  const [savingUserSchema, setSU] = useState(false)
  const [deleting, setDel]      = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  // Local copies for edits so unsaved schema changes don't fight with the
  // global data form rebuilding under them.
  const [globalSchema, setGlobalSchema] = useState<ServiceSchema>(
    service.global_settings_schema ?? { fields: [] }
  )
  const [userSchema, setUserSchema] = useState<ServiceSchema>(
    service.user_settings_schema ?? { fields: [] }
  )
  const [globalValues, setGlobalValues] = useState<Record<string, unknown>>(
    service.global_settings_data ?? {}
  )

  const [isPending, startTransition] = useTransition()

  function flash(msg: string) {
    setSuccess(msg)
    setError(null)
    setTimeout(() => setSuccess(null), 2500)
  }

  async function patchService(payload: Record<string, unknown>) {
    const res = await fetch(`/api/admin/services/${service.id}`, {
      method:  'PATCH',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? 'Something went wrong.')
    }
  }

  async function handleSaveBasic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSB(true)
    setError(null)
    try {
      await patchService({
        name:        service.name,
        description: service.description,
        icon:        service.icon,
        sort_order:  service.sort_order,
        enabled:     service.enabled,
      })
      flash('Basic details saved.')
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSB(false)
    }
  }

  async function handleSaveGlobalSchema() {
    setSG(true)
    setError(null)
    try {
      await patchService({ global_settings_schema: globalSchema })
      flash('Global schema saved. Now fill in the values below.')
      // Prune values whose keys no longer exist in the schema.
      const allowed = new Set(globalSchema.fields.map(f => f.key))
      setGlobalValues(prev => {
        const next: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(prev)) if (allowed.has(k)) next[k] = v
        return next
      })
      setService(prev => ({ ...prev, global_settings_schema: globalSchema }))
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSG(false)
    }
  }

  async function handleSaveGlobalValues(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSG(true)
    setError(null)
    try {
      await patchService({ global_settings_data: globalValues })
      flash('Global values saved and encrypted.')
      setService(prev => ({
        ...prev,
        has_global_settings: Object.keys(globalValues).length > 0,
        global_settings_data: globalValues,
      }))
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSG(false)
    }
  }

  async function handleClearGlobalValues() {
    if (!confirm('Clear all stored global values for this service?')) return
    setSG(true)
    setError(null)
    try {
      await patchService({ global_settings_data: null })
      flash('Global values cleared.')
      setGlobalValues({})
      setService(prev => ({ ...prev, has_global_settings: false, global_settings_data: null }))
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed.')
    } finally {
      setSG(false)
    }
  }

  async function handleSaveUserSchema() {
    setSU(true)
    setError(null)
    try {
      await patchService({ user_settings_schema: userSchema })
      flash('User schema saved.')
      setService(prev => ({
        ...prev,
        user_settings_schema: userSchema,
        has_user_settings:   userSchema.fields.length > 0,
      }))
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSU(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${service.name}" service? This also detaches it from every site.`)) return
    setDel(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Could not delete service.')
      }
      router.push('/admin/services')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
      setDel(false)
    }
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Service
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Boxes className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900 md:text-3xl">
              {service.name}
              <span className="text-brand-500">.</span>
            </h1>
            <p className="text-xs text-navy-500">
              <code>{service.key}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Toast-y feedback */}
      {(error || success) && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-brand-200 bg-brand-50 text-brand-700'
          }`}
        >
          {error ?? success}
        </div>
      )}

      {decryptError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Global settings couldn&apos;t be decrypted.
          </div>
          <p className="mt-1 text-xs">
            {decryptError}. The likely cause is that <code>SETTINGS_ENCRYPTION_KEY</code> has
            changed since the values were saved. You can clear and re-enter them below.
          </p>
        </div>
      )}

      {/* 1. Basic details */}
      <Card title="Basic details" icon={Boxes}>
        <form onSubmit={handleSaveBasic} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" required>
            <input
              type="text"
              required
              value={service.name}
              onChange={e => setService({ ...service, name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Key" hint="Read-only after creation.">
            <input
              type="text"
              value={service.key}
              disabled
              className="input cursor-not-allowed bg-navy-50/50 font-mono text-sm text-navy-500"
            />
          </Field>
          <Field label="Icon" hint="lucide-react icon name (e.g. BarChart3).">
            <input
              type="text"
              value={service.icon ?? ''}
              onChange={e => setService({ ...service, icon: e.target.value })}
              className="input font-mono text-sm"
            />
          </Field>
          <Field label="Sort order" hint="Lower numbers appear first.">
            <input
              type="number"
              value={service.sort_order}
              onChange={e => setService({ ...service, sort_order: Number(e.target.value) || 0 })}
              className="input"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                rows={2}
                value={service.description ?? ''}
                onChange={e => setService({ ...service, description: e.target.value })}
                className="input resize-none"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-3">
              <input
                type="checkbox"
                checked={service.enabled}
                onChange={e => setService({ ...service, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs text-navy-700">
                <span className="font-semibold text-navy-900">Enabled</span>
                <span className="block text-navy-500">Customers only see enabled services on their portal.</span>
              </span>
            </label>
          </div>
          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={savingBasic}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
            >
              {savingBasic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {savingBasic ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </form>
      </Card>

      {/* 2. Global settings */}
      <Card
        title="Global settings"
        icon={KeyRound}
        subtitle="Shared values used by every customer (e.g. your own API key). Encrypted at rest."
      >
        <SchemaEditor schema={globalSchema} onChange={setGlobalSchema} />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSaveGlobalSchema}
            disabled={savingGlobal}
            className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-60"
          >
            {savingGlobal ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save schema
          </button>
        </div>

        {globalSchema.fields.length > 0 && (
          <form onSubmit={handleSaveGlobalValues} className="mt-6 space-y-4 border-t border-navy-100 pt-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
                Values
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700">
                <Shield className="h-3 w-3" />
                Encrypted at rest
              </span>
            </div>
            <DataForm
              schema={globalSchema}
              values={globalValues}
              onChange={setGlobalValues}
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleClearGlobalValues}
                disabled={savingGlobal || !service.has_global_settings}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eraser className="h-3 w-3" />
                Clear stored values
              </button>
              <button
                type="submit"
                disabled={savingGlobal}
                className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
              >
                {savingGlobal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save values
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* 3. User (per-site) settings */}
      <Card
        title="User settings"
        icon={Settings2}
        subtitle="Fields collected per-website when this service is attached. Each customer's values are encrypted at rest."
      >
        <SchemaEditor schema={userSchema} onChange={setUserSchema} />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSaveUserSchema}
            disabled={savingUserSchema}
            className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
          >
            {savingUserSchema ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save user schema
          </button>
        </div>
      </Card>

      {/* 4. Danger zone */}
      <Card title="Danger zone" icon={Trash2} danger>
        <p className="mb-3 text-xs text-navy-600">
          Deleting this service detaches it from every website and removes any stored
          per-site user settings. Global values are also wiped.
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {deleting ? 'Deleting…' : 'Delete service'}
        </button>
      </Card>

      {isPending && null}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #dde7f2;
          background: #fff;
          padding: 0.55rem 0.85rem;
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
    </div>
  )
}

/* ─────────────────────────────────────── Schema editor ──────────────────────────────── */

function SchemaEditor({
  schema,
  onChange,
}: {
  schema:   ServiceSchema
  onChange: (next: ServiceSchema) => void
}) {
  function update(idx: number, patch: Partial<ServiceField>) {
    const next = schema.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    onChange({ fields: next })
  }
  function remove(idx: number) {
    onChange({ fields: schema.fields.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({
      fields: [
        ...schema.fields,
        { key: `field_${schema.fields.length + 1}`, label: 'New field', type: 'text' as FieldType },
      ],
    })
  }

  return (
    <div className="space-y-2">
      {schema.fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50/30 px-4 py-5 text-center text-xs text-navy-500">
          No fields defined.
        </div>
      ) : (
        schema.fields.map((f, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 gap-2 rounded-xl border border-navy-100 bg-white p-3 md:grid-cols-[1fr_1fr_180px_auto_auto]"
          >
            <input
              type="text"
              value={f.key}
              onChange={e =>
                update(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
              }
              placeholder="key"
              className="input font-mono text-xs"
            />
            <input
              type="text"
              value={f.label}
              onChange={e => update(idx, { label: e.target.value })}
              placeholder="Label"
              className="input"
            />
            <select
              value={f.type}
              onChange={e => update(idx, { type: e.target.value as FieldType })}
              className="input"
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-navy-600">
              <input
                type="checkbox"
                checked={Boolean(f.required)}
                onChange={e => update(idx, { required: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="inline-flex items-center justify-center rounded-full p-1.5 text-navy-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label="Remove field"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy-200 bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:border-brand-200 hover:bg-brand-50/40 hover:text-brand-700"
      >
        <Plus className="h-3 w-3" />
        Add field
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.6rem;
          border: 1px solid #dde7f2;
          background: #fff;
          padding: 0.4rem 0.7rem;
          font-size: 0.8rem;
          color: #0b2545;
        }
        .input:focus {
          outline: none;
          border-color: #7ca653;
          box-shadow: 0 0 0 3px rgba(124, 166, 83, 0.15);
        }
      `}</style>
    </div>
  )
}

/* ───────────────────────────────────────── Data form ────────────────────────────────── */

export function DataForm({
  schema,
  values,
  onChange,
}: {
  schema:   ServiceSchema
  values:   Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}) {
  function set(key: string, val: unknown) {
    const next = { ...values, [key]: val }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {schema.fields.map(f => {
        const v = values[f.key]
        switch (f.type) {
          case 'textarea':
            return (
              <Field key={f.key} label={f.label} hint={f.description} required={f.required}>
                <textarea
                  rows={3}
                  required={f.required}
                  value={typeof v === 'string' ? v : ''}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="input resize-none"
                />
              </Field>
            )
          case 'boolean':
            return (
              <label key={f.key} className="flex items-start gap-3 rounded-xl border border-navy-100 bg-white px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={Boolean(v)}
                  onChange={e => set(f.key, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-navy-700">
                  <span className="font-semibold text-navy-900">{f.label}</span>
                  {f.description && <span className="block text-navy-500">{f.description}</span>}
                </span>
              </label>
            )
          case 'number':
            return (
              <Field key={f.key} label={f.label} hint={f.description} required={f.required}>
                <input
                  type="number"
                  required={f.required}
                  value={typeof v === 'number' || typeof v === 'string' ? String(v) : ''}
                  onChange={e => set(f.key, e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={f.placeholder}
                  className="input"
                />
              </Field>
            )
          default: {
            const t = f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : 'text'
            return (
              <Field key={f.key} label={f.label} hint={f.description} required={f.required}>
                <input
                  type={t}
                  required={f.required}
                  autoComplete={t === 'password' ? 'new-password' : 'off'}
                  value={typeof v === 'string' ? v : ''}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="input"
                />
              </Field>
            )
          }
        }
      })}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #dde7f2;
          background: #fff;
          padding: 0.55rem 0.85rem;
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
  )
}

/* ───────────────────────────────────────── Layout helpers ───────────────────────────── */

function Card({
  title,
  subtitle,
  icon: Icon,
  danger,
  children,
}: {
  title:    string
  subtitle?: string
  icon:     React.ElementType
  danger?:  boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-2xl border bg-white p-5 shadow-soft ${
        danger ? 'border-red-100' : 'border-navy-100'
      }`}
    >
      <header className="mb-4 flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${
            danger
              ? 'bg-red-50 text-red-700 ring-red-100'
              : 'bg-brand-50 text-brand-700 ring-brand-100'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-navy-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-navy-500">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
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
