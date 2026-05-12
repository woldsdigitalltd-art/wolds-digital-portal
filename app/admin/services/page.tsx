import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowRight, Boxes, KeyRound, Settings2 } from 'lucide-react'
import NewServiceButton from './NewServiceButton'

interface ServiceRow {
  id:             string
  key:            string
  name:           string
  description:    string | null
  icon:           string | null
  enabled:        boolean
  sort_order:     number
  has_global:     boolean
  has_user:       boolean
}

export default async function AdminServicesPage() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services')
    .select(`
      id, key, name, description, icon, enabled, sort_order,
      global_settings_data, user_settings_schema
    `)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Couldn&apos;t load services: {error.message}
          </p>
          <p className="mt-3 text-xs text-red-600">
            Make sure the <code>supabase/migrations/20260515_services_catalog.sql</code>{' '}
            migration has been applied.
          </p>
        </div>
      </div>
    )
  }

  const services: ServiceRow[] = (data ?? []).map(r => ({
    id:          r.id,
    key:         r.key,
    name:        r.name,
    description: r.description,
    icon:        r.icon,
    enabled:     r.enabled,
    sort_order:  r.sort_order,
    has_global:  Boolean(r.global_settings_data),
    has_user:    Boolean(r.user_settings_schema),
  }))

  return (
    <div>
      <PageHeader />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 shadow-soft">
          <Boxes className="h-3.5 w-3.5 text-brand-600" />
          {services.length.toLocaleString('en-GB')} service{services.length === 1 ? '' : 's'}
        </div>
        <NewServiceButton />
      </div>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
          <Boxes className="mx-auto mb-3 h-8 w-8 text-navy-300" />
          <p className="text-sm text-navy-600">
            No services yet. Click <strong>New service</strong> to define your first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {services.map(service => (
            <Link
              key={service.id}
              href={`/admin/services/${service.id}`}
              className="group flex items-start gap-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition group-hover:bg-brand-100">
                <Boxes className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-navy-900">
                    {service.name}
                  </p>
                  {!service.enabled && (
                    <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold text-navy-600">
                      disabled
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-navy-500">
                  <code className="text-navy-700">{service.key}</code>
                </p>
                {service.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-navy-600">
                    {service.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Pill
                    icon={KeyRound}
                    label="Global config"
                    active={service.has_global}
                  />
                  <Pill
                    icon={Settings2}
                    label="User config"
                    active={service.has_user}
                  />
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function PageHeader() {
  return (
    <div className="mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
        Admin
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
        Services<span className="text-brand-500">.</span>
      </h1>
      <p className="mt-2 text-sm text-navy-600 md:text-base">
        Define what Wolds Digital sells. Each service has an optional global config
        (shared values like API keys) and an optional per-customer config we collect
        when the service is attached to one of their websites. All values are
        encrypted at rest.
      </p>
    </div>
  )
}

function Pill({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ElementType
  label: string
  active: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        active
          ? 'border-brand-100 bg-brand-50 text-brand-700'
          : 'border-navy-100 bg-navy-50/60 text-navy-500'
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      {active ? label : `${label} (not set)`}
    </span>
  )
}
