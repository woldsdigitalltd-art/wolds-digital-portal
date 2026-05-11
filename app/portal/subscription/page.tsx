import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const plans = {
  starter: { name: 'Starter', price: '£29', features: ['1 website', 'Analytics', 'Uptime monitoring', 'What\'s On page'] },
  pro:     { name: 'Pro',     price: '£59', features: ['Up to 3 websites', 'Everything in Starter', 'Priority support', 'Social scheduling'] },
  agency:  { name: 'Agency',  price: '£99', features: ['Unlimited websites', 'Everything in Pro', 'White-label portal', 'Dedicated account manager'] },
}

const statusConfig = {
  active:     { icon: CheckCircle,  label: 'Active',      bg: 'bg-green-50',  text: 'text-green-700'  },
  trialing:   { icon: Clock,        label: 'Free trial',  bg: 'bg-blue-50',   text: 'text-blue-700'   },
  past_due:   { icon: AlertCircle,  label: 'Payment due', bg: 'bg-amber-50',  text: 'text-amber-700'  },
  canceled:   { icon: AlertCircle,  label: 'Cancelled',   bg: 'bg-slate-100', text: 'text-slate-600'  },
  unpaid:     { icon: AlertCircle,  label: 'Unpaid',      bg: 'bg-red-50',    text: 'text-red-700'    },
  incomplete: { icon: Clock,        label: 'Incomplete',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
  paused:     { icon: Clock,        label: 'Paused',      bg: 'bg-slate-100', text: 'text-slate-600'  },
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
        <h1 className="text-2xl font-semibold text-slate-900">Subscription</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your plan and billing.</p>
      </div>

      <div className="space-y-4">
        {/* Current status */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Current plan</p>
              <p className="text-xl font-semibold text-slate-900">
                {plan ? plans[plan].name : 'No active plan'}
              </p>
              {plan && (
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {plans[plan].price}
                  <span className="text-sm font-normal text-slate-500">/month</span>
                </p>
              )}
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}
            </div>
          </div>

          {sub?.current_period_end && (
            <p className="text-xs text-slate-400 mt-4">
              {sub.cancel_at_period_end
                ? `Cancels on ${new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `Renews on ${new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
              }
            </p>
          )}

          {plan && (
            <ul className="mt-5 space-y-2">
              {plans[plan].features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Manage billing */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-900">Billing &amp; invoices</p>
              <p className="text-xs text-slate-500">Update payment method, download invoices</p>
            </div>
          </div>
          <button className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            Manage billing
          </button>
        </div>

        {/* Change plan */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-sm font-medium text-slate-900 mb-1">Need to change your plan?</p>
          <p className="text-xs text-slate-500 mb-4">
            Get in touch and we&apos;ll sort it out for you.
          </p>
          <a
            href="mailto:hello@woldsdigital.com?subject=Change my plan"
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            Contact us
          </a>
        </div>
      </div>
    </div>
  )
}
