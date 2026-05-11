import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const plans = {
  starter: { name: 'Starter', price: '£29', features: ['1 website', 'Analytics', 'Uptime monitoring', "What's on page"] },
  pro:     { name: 'Pro',     price: '£59', features: ['Up to 3 websites', 'Everything in Starter', 'Priority support', 'Social scheduling'] },
  agency:  { name: 'Agency',  price: '£99', features: ['Unlimited websites', 'Everything in Pro', 'White-label portal', 'Dedicated account manager'] },
}

const statusConfig = {
  active:     { icon: CheckCircle, label: 'Active',      bg: 'bg-brand-50',  text: 'text-brand-700', border: 'border-brand-100' },
  trialing:   { icon: Clock,       label: 'Free trial',  bg: 'bg-navy-50',   text: 'text-navy-700',  border: 'border-navy-100' },
  past_due:   { icon: AlertCircle, label: 'Payment due', bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-100' },
  canceled:   { icon: AlertCircle, label: 'Cancelled',   bg: 'bg-navy-50',   text: 'text-navy-700',  border: 'border-navy-100' },
  unpaid:     { icon: AlertCircle, label: 'Unpaid',      bg: 'bg-red-50',    text: 'text-red-700',   border: 'border-red-100' },
  incomplete: { icon: Clock,       label: 'Incomplete',  bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-100' },
  paused:     { icon: Clock,       label: 'Paused',      bg: 'bg-navy-50',   text: 'text-navy-700',  border: 'border-navy-100' },
}

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const { data: portalData } = await supabase.rpc('get_my_portal_data')
  const sub = portalData?.subscription

  const status = (sub?.status ?? 'trialing') as keyof typeof statusConfig
  const cfg    = statusConfig[status]
  const Icon   = cfg.icon
  const plan   = sub?.plan as keyof typeof plans | undefined

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">
          Billing
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          Subscription<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600">Manage your plan and billing.</p>
      </div>

      <div className="space-y-4">
        {/* Current plan */}
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400 mb-1">
                Current plan
              </p>
              <p className="text-xl font-bold text-navy-900">
                {plan ? plans[plan].name : 'No active plan'}
              </p>
              {plan && (
                <p className="mt-1 text-3xl font-bold text-navy-900">
                  {plans[plan].price}
                  <span className="text-sm font-medium text-navy-500">/month</span>
                </p>
              )}
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cfg.label}
            </span>
          </div>

          {sub?.current_period_end && (
            <p className="mt-4 text-xs text-navy-500">
              {sub.cancel_at_period_end
                ? `Cancels on ${new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `Renews on ${new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </p>
          )}

          {plan && (
            <ul className="mt-6 space-y-2.5">
              {plans[plan].features.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-navy-700">
                  <CheckCircle className="h-4 w-4 shrink-0 text-brand-500" />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Billing portal */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Billing &amp; invoices</p>
              <p className="text-xs text-navy-500">
                Update payment method, download invoices.
              </p>
            </div>
          </div>
          <button className="rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-navy-800 active:bg-navy-950">
            Manage billing
          </button>
        </div>

        {/* Change plan */}
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold text-navy-900">Need to change your plan?</p>
          <p className="mt-1 text-xs text-navy-500">
            Get in touch and we&apos;ll sort it out for you.
          </p>
          <a
            href="mailto:hello@woldsdigital.co.uk?subject=Change my plan"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-soft transition hover:border-brand-300 hover:text-brand-700"
          >
            Contact us
          </a>
        </div>
      </div>
    </div>
  )
}
