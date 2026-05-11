'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, CheckCircle, MapPin } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Status pill */}
        <div className="flex justify-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-navy-700 shadow-soft">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            Client Portal
          </span>
        </div>

        {/* Wordmark */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">
            <span className="text-navy-900">Wolds</span>{' '}
            <span className="text-brand-500">Digital</span>
            <span className="text-navy-400 text-lg font-medium align-top ml-0.5">Ltd</span>
          </h2>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-navy-500">
            <span className="h-px w-8 bg-navy-200" />
            IT Consultancy &amp; Website Development
            <span className="h-px w-8 bg-navy-200" />
          </div>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
            <MapPin className="h-3 w-3" />
            East Riding of Yorkshire
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-navy-100 bg-white p-8 shadow-soft">
          {!sent ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-navy-900">
                Welcome back<span className="text-brand-500">.</span>
              </h1>
              <p className="mt-1.5 text-sm text-navy-600">
                Enter your email and we&apos;ll send you a magic link — no password needed.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-wide text-navy-700 mb-2"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-full border border-navy-200 bg-white pl-11 pr-4 py-3 text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-5 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-navy-800 active:bg-navy-950 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending link…
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Send magic link
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100">
                <CheckCircle className="h-7 w-7 text-brand-600" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-navy-900">Check your inbox</h2>
              <p className="mt-2 text-sm text-navy-600">
                We sent a magic link to{' '}
                <span className="font-semibold text-navy-900">{email}</span>.
                <br />
                Click it to sign in.
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-6 text-xs font-medium text-navy-500 hover:text-navy-700 transition"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-navy-500">
          Don&apos;t have an account?{' '}
          <a
            href="mailto:hello@woldsdigital.co.uk"
            className="font-semibold text-brand-700 hover:text-brand-800 transition"
          >
            hello@woldsdigital.co.uk
          </a>
        </p>
      </div>
    </div>
  )
}
