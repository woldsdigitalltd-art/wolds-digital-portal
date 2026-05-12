import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  ExternalLink,
  Megaphone,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import NewIntegrationButton from './NewIntegrationButton'
import type { Integration } from '@/lib/integrations/types'

const SAFE_COLUMNS = `
  id, key, name, description, icon, provider, provider_url,
  provisioning_required, embed_enabled, enabled, sort_order
`

const ICON_MAP: Record<string, React.ElementType> = {
  Activity,
  BarChart3,
  Boxes,
  Megaphone,
  ShieldCheck,
  Zap,
}

export default async function AdminIntegrationsPage() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('integrations')
    .select(SAFE_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Couldn&apos;t load integrations: {error.message}
          </p>
          <p className="mt-3 text-xs text-red-600">
            Make sure the <code>integrations</code> and{' '}
            <code>site_integrations</code> tables exist.
          </p>
        </div>
      </div>
    )
  }

  const integrations = (data ?? []) as Integration[]

  return (
    <div>
      <PageHeader />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 shadow-soft">
          <Boxes className="h-3.5 w-3.5 text-brand-600" />
          {integrations.length.toLocaleString('en-GB')} integration{integrations.length === 1 ? '' : 's'}
        </div>
        <NewIntegrationButton />
      </div>

      {integrations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
          <Boxes className="mx-auto mb-3 h-8 w-8 text-navy-300" />
          <p className="text-sm text-navy-600">
            No integrations yet. Click <strong>New integration</strong> to register your first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {integrations.map(integration => {
            const Icon = (integration.icon && ICON_MAP[integration.icon]) || Boxes
            return (
              <div
                key={integration.id}
                className="flex items-start gap-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-soft"
              >
                <Link
                  href={`/admin/integrations/${integration.id}`}
                  className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100"
                  aria-label={`Edit ${integration.name}`}
                >
                  <Icon className="h-5 w-5" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/integrations/${integration.id}`}
                      className="truncate text-sm font-bold text-navy-900 hover:text-brand-700"
                    >
                      {integration.name}
                    </Link>
                    {!integration.enabled && (
                      <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold text-navy-600">
                        disabled
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-navy-500">
                    <code className="text-navy-700">{integration.key}</code>
                    {integration.provider && (
                      <> · {integration.provider}</>
                    )}
                  </p>
                  {integration.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-navy-600">
                      {integration.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {integration.provisioning_required && (
                      <Pill tone="amber">Auto-provisioned</Pill>
                    )}
                    {integration.embed_enabled && (
                      <Pill tone="brand">Embeddable</Pill>
                    )}
                    {integration.provider_url && (
                      <a
                        href={integration.provider_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-navy-100 bg-white px-2 py-0.5 text-[10px] font-semibold text-navy-600 transition hover:border-brand-200 hover:text-brand-700"
                      >
                        Open dashboard
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
                <Link
                  href={`/admin/integrations/${integration.id}`}
                  className="ml-auto mt-1 inline-flex items-center text-navy-300 transition hover:text-brand-600"
                  aria-label="Edit"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Pill({
  tone,
  children,
}: {
  tone:     'brand' | 'amber'
  children: React.ReactNode
}) {
  const cls =
    tone === 'brand'
      ? 'border-brand-100 bg-brand-50 text-brand-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}

function PageHeader() {
  return (
    <div className="mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
        Admin
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
        Integrations<span className="text-brand-500">.</span>
      </h1>
      <p className="mt-2 text-sm text-navy-600 md:text-base">
        The catalogue of providers Wolds Digital offers. Provider credentials
        live on each integration row but are never returned to the browser —
        set or rotate them directly in Supabase.
      </p>
    </div>
  )
}
