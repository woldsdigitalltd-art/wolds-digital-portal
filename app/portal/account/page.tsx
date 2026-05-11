'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle } from 'lucide-react'

export default function AccountPage() {
  const supabase = createClient()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [email, setEmail]       = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany]   = useState('')
  const [phone, setPhone]       = useState('')
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email ?? '')

      const { data } = await supabase
        .from('profiles')
        .select('full_name, company_name, phone')
        .eq('id', user.id)
        .single()

      if (data) {
        setFullName(data.full_name ?? '')
        setCompany(data.company_name ?? '')
        setPhone(data.phone ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, company_name: company, phone })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const initials =
    (company || fullName || email).trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'W'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-navy-400" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">
          Account
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          Your details<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Update your contact and business information.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft">
        {/* Header */}
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

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-6 px-6 py-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Full name"
              value={fullName}
              onChange={setFullName}
              placeholder="Jane Smith"
            />
            <Field
              label="Company name"
              value={company}
              onChange={setCompany}
              placeholder="Bridlington Drum Shack"
            />
            <Field
              label="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="+44 7700 000000"
              type="tel"
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
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
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
        className="w-full rounded-full border border-navy-200 bg-white px-4 py-2.5 text-sm text-navy-900 placeholder:text-navy-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      />
    </div>
  )
}
