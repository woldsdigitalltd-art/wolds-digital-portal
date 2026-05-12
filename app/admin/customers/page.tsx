import { createClient } from '@/lib/supabase/server'
import { Users, Globe, CreditCard, Clock } from 'lucide-react'

interface AdminCustomer {
  id:                     string
  email:                  string
  created_at:             string | null
  last_sign_in_at:        string | null
  full_name:              string | null
  company_name:           string | null
  phone:                  string | null
  site_count:             number
  plan:                   string | null
  subscription_status:    string | null
  subscription_renews_at: string | null
}

export default async function AdminCustomersPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_admin_customers')

  if (error) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Couldn&apos;t load customers: {error.message}
          </p>
        </div>
      </div>
    )
  }

  const customers = ((data ?? []) as AdminCustomer[])

  return (
    <div>
      <PageHeader />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 shadow-soft">
        <Users className="h-3.5 w-3.5 text-brand-600" />
        {customers.length.toLocaleString('en-GB')} customer{customers.length === 1 ? '' : 's'}
      </div>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-navy-300" />
          <p className="text-sm text-navy-600">
            No customers yet. Once you invite users from the Supabase dashboard
            they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50/60">
                <tr>
                  <Th>Customer</Th>
                  <Th>Company</Th>
                  <Th>Plan</Th>
                  <Th className="text-center">Sites</Th>
                  <Th>Last sign in</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {customers.map(c => (
                  <CustomerRow key={c.id} customer={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PageHeader() {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">
        Admin
      </p>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-navy-900">
        Customers<span className="text-brand-500">.</span>
      </h1>
      <p className="mt-2 text-sm md:text-base text-navy-600">
        Everyone using the client portal who isn&apos;t a Wolds Digital admin.
      </p>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-500 ${className}`}>
      {children}
    </th>
  )
}

function CustomerRow({ customer }: { customer: AdminCustomer }) {
  const display = customer.full_name?.trim() || customer.email.split('@')[0]
  const initials =
    display
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase() || customer.email[0]?.toUpperCase() || 'W'

  return (
    <tr className="hover:bg-navy-50/40 transition">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy-900">{display}</p>
            <p className="truncate text-xs text-navy-500">{customer.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-navy-700">
        {customer.company_name?.trim() || (
          <span className="text-navy-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <PlanBadge plan={customer.plan} status={customer.subscription_status} />
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 text-navy-700">
          <Globe className="h-3.5 w-3.5 text-navy-400" />
          {customer.site_count}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-navy-600">
        <RelativeDate value={customer.last_sign_in_at} fallback="Never" />
      </td>
      <td className="px-4 py-3 text-xs text-navy-600">
        <RelativeDate value={customer.created_at} fallback="—" />
      </td>
    </tr>
  )
}

function PlanBadge({ plan, status }: { plan: string | null; status: string | null }) {
  if (!plan) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-600">
        <CreditCard className="h-3 w-3" />
        No plan
      </span>
    )
  }

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
  const isActive = status === 'active' || status === 'trialing'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        isActive
          ? 'border-brand-100 bg-brand-50 text-brand-700'
          : 'border-amber-100 bg-amber-50 text-amber-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? 'bg-brand-500' : 'bg-amber-500'
        }`}
      />
      {planLabel}
      {status && status !== 'active' && (
        <span className="text-[10px] font-normal opacity-70">· {status}</span>
      )}
    </span>
  )
}

function RelativeDate({ value, fallback }: { value: string | null; fallback: string }) {
  if (!value) {
    return <span className="text-navy-400">{fallback}</span>
  }
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  const diffHr  = Math.round(diffMs / 3_600_000)
  const diffDay = Math.round(diffMs / 86_400_000)

  let label: string
  if (diffMin < 1)         label = 'just now'
  else if (diffMin < 60)   label = `${diffMin}m ago`
  else if (diffHr < 24)    label = `${diffHr}h ago`
  else if (diffDay < 30)   label = `${diffDay}d ago`
  else                     label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <span title={date.toLocaleString('en-GB')} className="inline-flex items-center gap-1">
      <Clock className="h-3 w-3 text-navy-300" />
      {label}
    </span>
  )
}
