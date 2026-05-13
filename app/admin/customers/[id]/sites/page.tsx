import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, ExternalLink, Globe } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import AddSiteButton from './AddSiteButton'

interface PageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function CustomerSitesPage({ params }: PageProps) {
  await requireAdmin()
  const { id: customerId } = await params

  const admin = createAdminClient()

  const [{ data: profile }, { data: userData }, { data: sites, error }] = await Promise.all([
    admin
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', customerId)
      .maybeSingle(),
    admin.auth.admin.getUserById(customerId),
    admin
      .from('sites')
      .select('id, domain, display_name')
      .eq('owner_id', customerId)
      .order('domain', { ascending: true }),
  ])

  if (!userData?.user) notFound()
  if (error) {
    console.error('admin customer sites: load failed:', error)
  }

  const email   = userData.user.email ?? ''
  const display = profile?.full_name?.trim() || profile?.company_name?.trim() || email
  const siteList = sites ?? []

  return (
    <div>
      <Link
        href="/admin/customers"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500 transition hover:text-navy-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All customers
      </Link>

      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Customer
        </p>
        <h1 className="mt-0.5 truncate text-2xl font-bold text-navy-900 md:text-3xl">
          {display}<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-1 text-xs text-navy-500">{email}</p>
      </header>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 shadow-soft">
          <Globe className="h-3.5 w-3.5 text-brand-600" />
          {siteList.length.toLocaleString('en-GB')} site{siteList.length === 1 ? '' : 's'}
        </div>
        <AddSiteButton customerId={customerId} />
      </div>

      {siteList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-10 text-center">
          <Globe className="mx-auto mb-3 h-8 w-8 text-navy-300" />
          <p className="text-sm text-navy-600">
            No websites yet. Add the first one to start managing services.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {siteList.map(site => (
            <li
              key={site.id}
              className="flex flex-col gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900">
                  {site.display_name?.trim() || site.domain}
                </p>
                <a
                  href={`https://${site.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-navy-500 transition hover:text-brand-700"
                >
                  {site.domain}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Link
                href={`/admin/customers/${customerId}/sites/${site.id}`}
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-navy-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft transition hover:bg-navy-800 sm:self-auto"
              >
                Manage
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
