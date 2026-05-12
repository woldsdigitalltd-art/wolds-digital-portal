'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Boxes,
  ExternalLink,
  Loader2,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import type { Integration } from '@/lib/integrations/types'

export default function IntegrationEditor({
  initialIntegration,
}: {
  initialIntegration: Integration
}) {
  const router = useRouter()
  const [integration, setIntegration] = useState<Integration>(initialIntegration)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDel]    = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [, startTransition]   = useTransition()

  function flash(msg: string) {
    setSuccess(msg)
    setError(null)
    setTimeout(() => setSuccess(null), 2500)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}`, {
        method:  'PATCH',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          name:                  integration.name,
          description:           integration.description,
          icon:                  integration.icon,
          provider:              integration.provider,
          provider_url:          integration.provider_url,
          sort_order:            integration.sort_order,
          enabled:               integration.enabled,
          provisioning_required: integration.provisioning_required,
          embed_enabled:         integration.embed_enabled,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Save failed.')
      flash('Saved.')
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${integration.name}" integration? This detaches it from every site.`)) return
    setDel(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not delete integration.')
      router.push('/admin/integrations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
      setDel(false)
    }
  }

  return (
    <div className="space-y-8 pb-16">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Integration
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Boxes className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900 md:text-3xl">
              {integration.name}
              <span className="text-brand-500">.</span>
            </h1>
            <p className="text-xs text-navy-500">
              <code>{integration.key}</code>
              {integration.provider && <> · {integration.provider}</>}
            </p>
          </div>
          {integration.provider_url && (
            <a
              href={integration.provider_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              Open dashboard
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
        <div className="mb-1 inline-flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-3.5 w-3.5" />
          Credentials live elsewhere
        </div>
        <p className="leading-relaxed">
          Provider API keys are stored in the <code>integrations.credentials</code> JSON
          column and are <em>never</em> returned to the browser. Set or rotate them in
          Supabase, e.g. <code>{'update public.integrations set credentials = \'{"api_key":"…"}\'::jsonb where key = \'uptime\''}</code>.
        </p>
      </div>

      <Card title="Basic details" icon={Boxes}>
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" required>
            <input
              type="text"
              required
              value={integration.name}
              onChange={e => setIntegration({ ...integration, name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Key" hint="Read-only after creation.">
            <input
              type="text"
              value={integration.key}
              disabled
              className="input cursor-not-allowed bg-navy-50/50 font-mono text-sm text-navy-500"
            />
          </Field>
          <Field label="Icon" hint="lucide-react icon name (e.g. Activity).">
            <input
              type="text"
              value={integration.icon ?? ''}
              onChange={e => setIntegration({ ...integration, icon: e.target.value })}
              className="input font-mono text-sm"
            />
          </Field>
          <Field label="Sort order" hint="Lower numbers appear first.">
            <input
              type="number"
              value={integration.sort_order}
              onChange={e => setIntegration({ ...integration, sort_order: Number(e.target.value) || 0 })}
              className="input"
            />
          </Field>
          <Field label="Provider" hint="Free-form vendor label.">
            <input
              type="text"
              value={integration.provider ?? ''}
              onChange={e => setIntegration({ ...integration, provider: e.target.value || null })}
              placeholder="betterstack"
              className="input"
            />
          </Field>
          <Field label="Provider dashboard URL">
            <input
              type="url"
              value={integration.provider_url ?? ''}
              onChange={e => setIntegration({ ...integration, provider_url: e.target.value || null })}
              placeholder="https://uptime.betterstack.com/"
              className="input"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                rows={2}
                value={integration.description ?? ''}
                onChange={e => setIntegration({ ...integration, description: e.target.value })}
                className="input resize-none"
              />
            </Field>
          </div>
          <div className="flex items-end gap-3 md:col-span-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={integration.provisioning_required}
                onChange={e =>
                  setIntegration({ ...integration, provisioning_required: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs">
                <span className="font-semibold text-navy-900">Provisioning required</span>
                <span className="block text-navy-500">Triggers an external API call on enable.</span>
              </span>
            </label>
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={integration.embed_enabled}
                onChange={e =>
                  setIntegration({ ...integration, embed_enabled: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs">
                <span className="font-semibold text-navy-900">Embed enabled</span>
                <span className="block text-navy-500">Has a customer-facing widget.</span>
              </span>
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 px-3.5 py-3">
              <input
                type="checkbox"
                checked={integration.enabled}
                onChange={e => setIntegration({ ...integration, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs text-navy-700">
                <span className="font-semibold text-navy-900">Enabled platform-wide</span>
                <span className="block text-navy-500">When off, admins can&apos;t attach this integration to new sites.</span>
              </span>
            </label>
          </div>
          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Danger zone" icon={Trash2} danger>
        <p className="mb-3 text-xs text-navy-600">
          Deleting this integration detaches it from every website. External resources
          (e.g. Better Stack monitors) won&apos;t be cleaned up automatically — deprovision
          each linked site first to avoid orphaned monitors.
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {deleting ? 'Deleting…' : 'Delete integration'}
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

function Card({
  title,
  icon: Icon,
  danger,
  children,
}: {
  title:    string
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
