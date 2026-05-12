import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowRight, Boxes, KeyRound } from 'lucide-react'
import NewServiceButton from './NewServiceButton'
import type { ServiceWithAuth } from '@/lib/services/types'

export default async function AdminServicesPage() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services_with_auth')
    .select('*')
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
            Make sure the <code>services</code> / <code>service_auth_types</code> tables and the{' '}
            <code>services_with_auth</code> view exist.
          </p>
        </div>
      </div>
    )
  }

  const services = (data ?? []) as ServiceWithAuth[]

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
          {services.map(service => {
            const options = service.auth_options ?? []
            const defaultOption =
              options.find(o => o.is_default) ??
              [...options].sort((a, b) => a.sort_order - b.sort_order)[0]
            return (
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
                    {service.provisioning_required && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                        provisioned
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
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        options.length > 0
                          ? 'border-brand-100 bg-brand-50 text-brand-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      <KeyRound className="h-2.5 w-2.5" />
                      {options.length} auth method{options.length === 1 ? '' : 's'}
                    </span>
                    {defaultOption && (
                      <span className="inline-flex items-center rounded-full border border-navy-100 bg-navy-50/60 px-2 py-0.5 text-[10px] font-semibold text-navy-600">
                        default: {defaultOption.label}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </Link>
            )
          })}
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
        Define what Wolds Digital sells. Each service has one or more <em>auth
        methods</em> (e.g. &ldquo;Client connects their own Buffer&rdquo; vs &ldquo;Managed
        under our Buffer account&rdquo;), and each auth method has its own form
        of fields the admin fills in when attaching the service to a site.
      </p>
    </div>
  )
}
