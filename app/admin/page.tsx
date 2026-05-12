import { createClient } from '@/lib/supabase/server'
import {
  Users,
  Building2,
  Globe,
  CreditCard,
  ShieldCheck,
  Activity,
  TrendingUp,
} from 'lucide-react'

interface AdminStats {
  total_users:          number
  total_admins:         number
  total_customers:      number
  total_companies:      number
  total_websites:       number
  total_subscriptions:  number
  active_subscriptions: number
  monitored_sites:      number
}

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const { data: stats, error } = await supabase.rpc('get_admin_stats')

  if (error) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Couldn&apos;t load admin stats: {error.message}
          </p>
          <p className="mt-2 text-xs text-red-600">
            Did you run the SQL migration in <code>supabase/migrations/20260512_admin_role.sql</code>?
          </p>
        </div>
      </div>
    )
  }

  const s = (stats ?? {}) as Partial<AdminStats>

  return (
    <div>
      <PageHeader />

      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Customers"
          value={s.total_customers ?? 0}
          hint={`${s.total_users ?? 0} total user${(s.total_users ?? 0) === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Building2}
          label="Companies"
          value={s.total_companies ?? 0}
          hint="Unique company names"
        />
        <StatCard
          icon={Globe}
          label="Websites"
          value={s.total_websites ?? 0}
          hint={`${s.monitored_sites ?? 0} with uptime monitoring`}
        />
        <StatCard
          icon={CreditCard}
          label="Subscriptions"
          value={s.total_subscriptions ?? 0}
          hint={`${s.active_subscriptions ?? 0} active`}
        />
      </div>

      {/* Detail strip */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailCard
          icon={ShieldCheck}
          title="Admins"
          value={s.total_admins ?? 0}
          description="Internal team members with admin access to this portal."
        />
        <DetailCard
          icon={Activity}
          title="Monitored sites"
          value={s.monitored_sites ?? 0}
          description="Sites currently being checked for uptime."
          accent
        />
      </div>

      <div className="mt-10 rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">Want more detail?</p>
            <p className="mt-1 text-xs text-navy-500">
              The <a href="/admin/customers" className="font-semibold text-brand-700 hover:underline">Customers</a> page shows every non-admin user, their company, plan, sites and last sign-in.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <div className="mb-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">
        Admin
      </p>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-navy-900">
        Overview<span className="text-brand-500">.</span>
      </h1>
      <p className="mt-2 text-sm md:text-base text-navy-600">
        A snapshot of everything happening across the Wolds Digital client portal.
      </p>
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, hint,
}: {
  icon: React.ElementType
  label: string
  value: number
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
        <Icon className="h-3.5 w-3.5 text-brand-600" />
        {label}
      </div>
      <p className="mt-3 text-4xl font-bold tracking-tight text-navy-900">
        {value.toLocaleString('en-GB')}
      </p>
      {hint && <p className="mt-2 text-xs text-navy-500">{hint}</p>}
    </div>
  )
}

function DetailCard({
  icon: Icon, title, value, description, accent = false,
}: {
  icon: React.ElementType
  title: string
  value: number
  description: string
  accent?: boolean
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border p-5 shadow-soft ${
        accent ? 'border-brand-100 bg-brand-50/40' : 'border-navy-100 bg-white'
      }`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${
        accent
          ? 'bg-white text-brand-700 ring-brand-100'
          : 'bg-brand-50 text-brand-700 ring-brand-100'
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-navy-900">{title}</p>
          <p className="text-2xl font-bold text-navy-900">
            {value.toLocaleString('en-GB')}
          </p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-navy-500">{description}</p>
      </div>
    </div>
  )
}
