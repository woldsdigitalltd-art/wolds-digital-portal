import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Globe } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasIntegration } from '@/app/portal/websites/[id]/site-loader'
import { loadSiteAsAdmin } from '../site-loader'
import Subnav from './Subnav'

interface LayoutProps {
  children: React.ReactNode
  params:   Promise<{ id: string; siteId: string }>
}

export default async function AdminWebsiteLayout({ children, params }: LayoutProps) {
  await requireAdmin()
  const { id: customerId, siteId } = await params

  const site = await loadSiteAsAdmin(siteId, customerId)
  if (!site) notFound()

  const hasSeo         = hasIntegration(site, 'seoscoreapi')
  const hasMonitor     = hasIntegration(site, 'betterstack')
  const hasPageSpeed   = hasIntegration(site, 'pagespeed')
  const hasBrokenLinks = hasIntegration(site, 'brokenlinks')
  const display        = site.display_name?.trim() || site.domain

  const admin = createAdminClient()
  const [{ data: profile }, { data: userData }] = await Promise.all([
    admin
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', customerId)
      .maybeSingle(),
    admin.auth.admin.getUserById(customerId),
  ])

  const customerEmail = userData?.user?.email ?? ''
  const customerLabel =
    profile?.full_name?.trim() ||
    profile?.company_name?.trim() ||
    customerEmail ||
    'Customer'

  return (
    <div data-fullbleed className="flex min-h-full">
      <Subnav
        customerId={customerId}
        siteId={site.id}
        hasSeo={hasSeo}
        hasMonitor={hasMonitor}
        hasPageSpeed={hasPageSpeed}
        hasBrokenLinks={hasBrokenLinks}
      />

      <div className="min-w-0 flex-1 px-6 py-10 md:px-8 md:py-12">
        <Link
          href={`/admin/customers/${customerId}/sites`}
          className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500 transition hover:text-navy-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {customerLabel}&apos;s sites
        </Link>

        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <Globe className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                Website · admin view
              </p>
              <h1 className="mt-0.5 truncate text-2xl font-bold text-navy-900 md:text-3xl">
                {display}<span className="text-brand-500">.</span>
              </h1>
              <a
                href={`https://${site.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 transition hover:text-brand-800"
              >
                {site.domain}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </header>

        <div>{children}</div>
      </div>
    </div>
  )
}
