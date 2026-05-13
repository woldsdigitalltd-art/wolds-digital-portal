import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Globe } from 'lucide-react'
import Subnav from './Subnav'
import { hasIntegration, loadOwnedSite } from './site-loader'

interface LayoutProps {
  children: React.ReactNode
  params:   Promise<{ id: string }>
}

export default async function WebsiteLayout({ children, params }: LayoutProps) {
  const { id } = await params
  const site   = await loadOwnedSite(id)
  if (!site) notFound()

  const hasSeo         = hasIntegration(site, 'seoscoreapi')
  const hasMonitor     = hasIntegration(site, 'betterstack')
  const hasPageSpeed   = hasIntegration(site, 'pagespeed')
  const hasBrokenLinks = hasIntegration(site, 'brokenlinks')
  const display        = site.display_name?.trim() || site.domain

  return (
    <div>
      <Link
        href="/portal/websites"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500 transition hover:text-navy-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All websites
      </Link>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Globe className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Website
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

      <div className="mb-6">
        <Subnav
          siteId={site.id}
          hasSeo={hasSeo}
          hasMonitor={hasMonitor}
          hasPageSpeed={hasPageSpeed}
          hasBrokenLinks={hasBrokenLinks}
        />
      </div>

      <div>{children}</div>
    </div>
  )
}
