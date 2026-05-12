'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import type {
  AuthType,
  FieldType,
  SchemaField,
  SchemaFieldOption,
  ServiceAuthType,
  ServiceWithAuth,
  SettingsSchema,
} from '@/lib/services/types'

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text',     label: 'Text' },
  { value: 'password', label: 'Password (masked)' },
  { value: 'email',    label: 'Email' },
  { value: 'url',      label: 'URL' },
  { value: 'select',   label: 'Select (dropdown)' },
]

const AUTH_TYPE_OPTIONS: { value: AuthType; label: string; help: string }[] = [
  {
    value: 'platform_key',
    label: 'Platform key',
    help:  'Wolds Digital uses its own credentials on the customer\'s behalf.',
  },
  {
    value: 'oauth_client',
    label: 'OAuth (client account)',
    help:  'Customer authorises us against their own account via OAuth.',
  },
  {
    value: 'oauth_platform',
    label: 'OAuth (platform account)',
    help:  'A single shared OAuth-connected account managed by Wolds Digital.',
  },
  {
    value: 'manual',
    label: 'Manual',
    help:  'Customer pastes a value (property ID, embed code, etc).',
  },
]

export default function ServiceEditor({
  initialService,
}: {
  initialService: ServiceWithAuth
}) {
  const router = useRouter()

  const [service, setService]   = useState<ServiceWithAuth>(initialService)
  const [savingBasic, setSB]    = useState(false)
  const [deleting, setDel]      = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)
  const [, startTransition]     = useTransition()

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
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'Something went wrong.')
  }

  async function handleSaveBasic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSB(true)
    setError(null)
    try {
      await patchService({
        name:                  service.name,
        description:           service.description,
        icon:                  service.icon,
        sort_order:            service.sort_order,
        enabled:               service.enabled,
        provider:              service.provider,
        provisioning_required: service.provisioning_required,
        embed_enabled:         service.embed_enabled,
      })
      flash('Basic details saved.')
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSB(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${service.name}" service? This also detaches it from every site.`)) return
    setDel(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not delete service.')
      router.push('/admin/services')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
      setDel(false)
    }
  }

  function onAuthOptionsChanged(next: ServiceAuthType[]) {
    setService(prev => ({ ...prev, auth_options: next }))
    startTransition(() => router.refresh())
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
          <Field label="Provider" hint="External provider name (free text).">
            <input
              type="text"
              value={service.provider ?? ''}
              onChange={e => setService({ ...service, provider: e.target.value || null })}
              placeholder="Better Stack"
              className="input"
            />
          </Field>
          <div className="flex items-end gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={service.provisioning_required}
                onChange={e =>
                  setService({ ...service, provisioning_required: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs">
                <span className="font-semibold text-navy-900">Provisioning required</span>
                <span className="block text-navy-500">Status starts as <code>pending</code>.</span>
              </span>
            </label>
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={service.embed_enabled}
                onChange={e =>
                  setService({ ...service, embed_enabled: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs">
                <span className="font-semibold text-navy-900">Embed enabled</span>
                <span className="block text-navy-500">Can render an embedded widget.</span>
              </span>
            </label>
          </div>
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
                <span className="block text-navy-500">Disabled services can&apos;t be attached to new sites and disappear from customer dashboards.</span>
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

      {/* 2. Auth options */}
      <Card
        title="Auth methods"
        icon={KeyRound}
        subtitle="One or more ways customers can connect this service. Each method has its own form of fields that admins fill in when attaching the service to a site."
      >
        <AuthOptionsManager
          serviceId={service.id}
          options={service.auth_options ?? []}
          onChanged={onAuthOptionsChanged}
          onError={msg => setError(msg)}
          onSuccess={flash}
        />
      </Card>

      {/* 3. Danger zone */}
      <Card title="Danger zone" icon={Trash2} danger>
        <p className="mb-3 text-xs text-navy-600">
          Deleting this service detaches it from every website, removes all its auth
          methods and stored per-site credentials.
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

/* ─────────────────────────────────────── Auth options manager ──────────────────────────────── */

function AuthOptionsManager({
  serviceId,
  options,
  onChanged,
  onError,
  onSuccess,
}: {
  serviceId: string
  options:   ServiceAuthType[]
  onChanged: (next: ServiceAuthType[]) => void
  onError:   (msg: string) => void
  onSuccess: (msg: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId]     = useState<string | null>(null)

  const sorted = [...options].sort((a, b) =>
    (a.sort_order - b.sort_order) || a.label.localeCompare(b.label)
  )

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch(`/api/admin/services/${serviceId}/auth-types`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          auth_type:       'manual',
          label:           'New auth method',
          description:     '',
          settings_schema: { fields: [] },
          is_default:      options.length === 0,
          sort_order:      options.length * 10,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        auth_option?: ServiceAuthType
        error?:       string
      }
      if (!res.ok || !data.auth_option) {
        throw new Error(data.error ?? 'Could not create auth method.')
      }
      onChanged([...options, data.auth_option])
      setOpenId(data.auth_option.id)
      onSuccess('Auth method created — edit its details below.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed.')
    } finally {
      setCreating(false)
    }
  }

  function replaceLocal(updated: ServiceAuthType) {
    onChanged(
      options.map(o => {
        if (o.id === updated.id) return updated
        if (updated.is_default) return { ...o, is_default: false }
        return o
      })
    )
  }
  function removeLocal(id: string) {
    onChanged(options.filter(o => o.id !== id))
    if (openId === id) setOpenId(null)
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-5 text-center text-xs text-amber-800">
          No auth methods defined yet. The service can&apos;t be attached to any sites until you
          add at least one.
        </div>
      ) : (
        sorted.map(opt => (
          <AuthOptionCard
            key={opt.id}
            serviceId={serviceId}
            option={opt}
            open={openId === opt.id}
            onToggle={() => setOpenId(openId === opt.id ? null : opt.id)}
            onUpdated={replaceLocal}
            onDeleted={() => removeLocal(opt.id)}
            onError={onError}
            onSuccess={onSuccess}
          />
        ))
      )}

      <div className="pt-1">
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy-200 bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-navy-700 transition hover:border-brand-200 hover:bg-brand-50/40 hover:text-brand-700 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add auth method
        </button>
      </div>
    </div>
  )
}

function AuthOptionCard({
  serviceId,
  option,
  open,
  onToggle,
  onUpdated,
  onDeleted,
  onError,
  onSuccess,
}: {
  serviceId: string
  option:    ServiceAuthType
  open:      boolean
  onToggle:  () => void
  onUpdated: (next: ServiceAuthType) => void
  onDeleted: () => void
  onError:   (msg: string) => void
  onSuccess: (msg: string) => void
}) {
  const [draft, setDraft]   = useState<ServiceAuthType>(option)
  const [saving, setSaving] = useState(false)
  const [deleting, setDel]  = useState(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(option)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/admin/services/${serviceId}/auth-types/${option.id}`,
        {
          method:  'PATCH',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({
            auth_type:       draft.auth_type,
            label:           draft.label,
            description:     draft.description,
            settings_schema: draft.settings_schema ?? { fields: [] },
            is_default:      draft.is_default,
            sort_order:      draft.sort_order,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Save failed.')
      onUpdated(draft)
      onSuccess('Auth method saved.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${option.label}" auth method?`)) return
    setDel(true)
    try {
      const res = await fetch(
        `/api/admin/services/${serviceId}/auth-types/${option.id}`,
        { method: 'DELETE' },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Delete failed.')
      onDeleted()
      onSuccess('Auth method removed.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Delete failed.')
      setDel(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-navy-50/40"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {open
            ? <ChevronDown className="h-4 w-4 shrink-0 text-navy-400" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-navy-900">
                {option.label || '(unnamed)'}
              </span>
              {option.is_default && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-100">
                  <Star className="h-2.5 w-2.5" />
                  default
                </span>
              )}
              <span className="rounded-full bg-navy-50 px-2 py-0.5 font-mono text-[10px] text-navy-600">
                {option.auth_type}
              </span>
            </div>
            {option.description && (
              <p className="truncate text-[11px] text-navy-500">{option.description}</p>
            )}
          </div>
        </div>
        <span className="text-[10px] text-navy-400">
          {option.settings_schema?.fields?.length ?? 0} field{(option.settings_schema?.fields?.length ?? 0) === 1 ? '' : 's'}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-navy-100 bg-navy-50/30 px-4 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Label" required>
              <input
                type="text"
                required
                value={draft.label}
                onChange={e => setDraft({ ...draft, label: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Auth type">
              <select
                value={draft.auth_type}
                onChange={e => setDraft({ ...draft, auth_type: e.target.value as AuthType })}
                className="input"
              >
                {AUTH_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="mt-1 block text-[10px] text-navy-400">
                {AUTH_TYPE_OPTIONS.find(o => o.value === draft.auth_type)?.help}
              </span>
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={draft.sort_order}
                onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                className="input"
              />
            </Field>
            <div className="flex items-end">
              <label className="flex w-full items-center gap-2 rounded-xl border border-navy-100 bg-white px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={draft.is_default}
                  onChange={e => setDraft({ ...draft, is_default: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs">
                  <span className="font-semibold text-navy-900">Default method</span>
                  <span className="block text-navy-500">Pre-selected in the picker.</span>
                </span>
              </label>
            </div>
            <div className="md:col-span-2">
              <Field label="Description">
                <textarea
                  rows={2}
                  value={draft.description ?? ''}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}
                  className="input resize-none"
                />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-500">
              Form fields for this auth method
            </p>
            <SchemaEditor
              schema={draft.settings_schema ?? { fields: [] }}
              onChange={s => setDraft({ ...draft, settings_schema: s })}
            />
          </div>

          <div className="flex items-center justify-between border-t border-navy-100 pt-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete method
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || deleting}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? 'Save method' : 'Saved'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #dde7f2;
          background: #fff;
          padding: 0.5rem 0.8rem;
          font-size: 0.85rem;
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

/* ─────────────────────────────────────── Schema editor ──────────────────────────────── */

function SchemaEditor({
  schema,
  onChange,
}: {
  schema:   SettingsSchema
  onChange: (next: SettingsSchema) => void
}) {
  function update(idx: number, patch: Partial<SchemaField>) {
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
        {
          key:      `field_${schema.fields.length + 1}`,
          label:    'New field',
          type:     'text',
          required: false,
        },
      ],
    })
  }

  return (
    <div className="space-y-2">
      {schema.fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-200 bg-white/60 px-4 py-5 text-center text-xs text-navy-500">
          No fields. The admin will only see the auth-method picker for this method.
        </div>
      ) : (
        schema.fields.map((f, idx) => (
          <FieldEditor
            key={idx}
            field={f}
            onChange={patch => update(idx, patch)}
            onRemove={() => remove(idx)}
          />
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
    </div>
  )
}

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field:    SchemaField
  onChange: (patch: Partial<SchemaField>) => void
  onRemove: () => void
}) {
  function updateOptions(next: SchemaFieldOption[]) {
    onChange({ options: next })
  }

  return (
    <div className="space-y-2 rounded-xl border border-navy-100 bg-white p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_180px_auto_auto]">
        <input
          type="text"
          value={field.key}
          onChange={e =>
            onChange({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
          }
          placeholder="key"
          className="input font-mono text-xs"
        />
        <input
          type="text"
          value={field.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="Label"
          className="input"
        />
        <select
          value={field.type}
          onChange={e => onChange({ type: e.target.value as FieldType })}
          className="input"
        >
          {FIELD_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-navy-600">
          <input
            type="checkbox"
            checked={Boolean(field.required)}
            onChange={e => onChange({ required: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
          />
          Required
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center justify-center rounded-full p-1.5 text-navy-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label="Remove field"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <input
          type="text"
          value={field.placeholder ?? ''}
          onChange={e => onChange({ placeholder: e.target.value || undefined })}
          placeholder="Placeholder (optional)"
          className="input text-xs"
        />
        <input
          type="text"
          value={field.help ?? ''}
          onChange={e => onChange({ help: e.target.value || undefined })}
          placeholder="Help text (optional)"
          className="input text-xs"
        />
      </div>

      {field.type === 'select' && (
        <SelectOptionsEditor
          options={field.options ?? []}
          onChange={updateOptions}
        />
      )}

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

function SelectOptionsEditor({
  options,
  onChange,
}: {
  options:  SchemaFieldOption[]
  onChange: (next: SchemaFieldOption[]) => void
}) {
  function update(idx: number, patch: Partial<SchemaFieldOption>) {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)))
  }
  function add() {
    onChange([...options, { value: '', label: '' }])
  }
  function remove(idx: number) {
    onChange(options.filter((_, i) => i !== idx))
  }

  return (
    <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-500">
        Dropdown options
      </p>
      <div className="space-y-1.5">
        {options.length === 0 ? (
          <p className="text-[11px] text-navy-500">No options yet.</p>
        ) : (
          options.map((opt, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="text"
                value={String(opt.value)}
                onChange={e => update(idx, { value: e.target.value })}
                placeholder="value"
                className="input font-mono text-xs"
              />
              <input
                type="text"
                value={opt.label}
                onChange={e => update(idx, { label: e.target.value })}
                placeholder="Label"
                className="input text-xs"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="inline-flex items-center justify-center rounded-full p-1.5 text-navy-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remove option"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed border-navy-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-navy-700 transition hover:border-brand-200 hover:text-brand-700"
      >
        <Plus className="h-2.5 w-2.5" />
        Add option
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #dde7f2;
          background: #fff;
          padding: 0.35rem 0.6rem;
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

/* ───────────────────────────────────────── Data form (exported) ─────────────────────── */

/**
 * Generic, schema-driven form. Reused by ManageSitesButton when an
 * admin attaches/edits a service for a site.
 */
export function DataForm({
  schema,
  values,
  onChange,
  readOnly,
}: {
  schema:   SettingsSchema
  values:   Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  readOnly?: boolean
}) {
  function set(key: string, val: unknown) {
    onChange({ ...values, [key]: val })
  }

  if (schema.fields.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-navy-200 bg-white/60 px-3 py-2.5 text-center text-[11px] text-navy-500">
        No fields required for this auth method.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {schema.fields.map(f => {
        const raw = values[f.key]
        const v   = raw === undefined || raw === null ? '' : raw

        if (f.type === 'select') {
          return (
            <Field key={f.key} label={f.label} hint={f.help} required={f.required}>
              <select
                required={f.required}
                disabled={readOnly}
                value={typeof v === 'string' || typeof v === 'number' ? String(v) : ''}
                onChange={e => set(f.key, e.target.value)}
                className="data-input"
              >
                <option value="" disabled>
                  {f.placeholder ?? 'Choose…'}
                </option>
                {(f.options ?? []).map(o => (
                  <option key={String(o.value)} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          )
        }

        const inputType =
          f.type === 'password' ? 'password' :
          f.type === 'email'    ? 'email'    :
          f.type === 'url'      ? 'url'      : 'text'

        return (
          <Field key={f.key} label={f.label} hint={f.help} required={f.required}>
            <input
              type={inputType}
              required={f.required}
              disabled={readOnly}
              autoComplete={inputType === 'password' ? 'new-password' : 'off'}
              value={typeof v === 'string' ? v : String(v)}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="data-input"
            />
          </Field>
        )
      })}

      <style jsx>{`
        .data-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #dde7f2;
          background: #fff;
          padding: 0.55rem 0.85rem;
          font-size: 0.875rem;
          color: #0b2545;
        }
        .data-input::placeholder { color: #94a8c0; }
        .data-input:disabled {
          background: #f5f8fc;
          color: #6b7e96;
          cursor: not-allowed;
        }
        .data-input:focus {
          outline: none;
          border-color: #7ca653;
          box-shadow: 0 0 0 3px rgba(124, 166, 83, 0.15);
        }
      `}</style>
    </div>
  )
}
