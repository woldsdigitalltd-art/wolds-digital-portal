'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  email:           string
  initialFullName: string
  initialCompany:  string
  initialPhone:    string
}

export default function AccountForm({
  email, initialFullName, initialCompany, initialPhone,
}: Props) {
  const router = useRouter()

  const [fullName, setFullName] = useState(initialFullName)
  const [company,  setCompany]  = useState(initialCompany)
  const [phone,    setPhone]    = useState(initialPhone)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Write through the portal API so we don't depend on per-column
      // RLS grants in the browser. The route authenticates via the
      // session cookie and writes via service_role.
      const res = await fetch('/api/portal/profile', {
        method:  'PATCH',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
          full_name:    fullName.trim() || null,
          company_name: company.trim()  || null,
          phone:        phone.trim()    || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not save profile.')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Refresh the layout so the sidebar greeting picks up changes.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  const initials =
    (company || fullName || email)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase() || 'W'

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft">
      <div className="flex items-center gap-4 border-b border-navy-100 px-6 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy-900">
            {fullName || company || 'Your account'}
          </p>
          <p className="truncate text-xs text-navy-500">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 px-6 py-7">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Full name"
            value={fullName}
            onChange={setFullName}
            placeholder="Jane Smith"
            autoComplete="name"
          />
          <Field
            label="Company name"
            value={company}
            onChange={setCompany}
            placeholder="Bridlington Drum Shack"
            autoComplete="organization"
          />
          <Field
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="+44 7700 000000"
            type="tel"
            autoComplete="tel"
          />
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-navy-700">
              Email address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full cursor-not-allowed rounded-full border border-navy-100 bg-navy-50/60 px-4 py-2.5 text-sm text-navy-400"
            />
            <p className="mt-1.5 text-xs text-navy-400">
              Email is managed via your login link.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-navy-800 active:bg-navy-950 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
              <CheckCircle className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', autoComplete,
}: {
  label:         string
  value:         string
  onChange:      (v: string) => void
  placeholder?:  string
  type?:         string
  autoComplete?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-navy-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-full border border-navy-200 bg-white px-4 py-2.5 text-sm text-navy-900 placeholder:text-navy-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      />
    </div>
  )
}
