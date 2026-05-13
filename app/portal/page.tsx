import { createClient } from '@/lib/supabase/server'
import { fetchUptimeBySite } from '@/lib/integrations/uptime'
import { Activity, ArrowRight, BarChart3, CreditCard, ExternalLink, Megaphone } from 'lucide-react'
import Link from 'next/link'

interface WebsiteIntegration {
  id:   string
  key:  string
  name: string
}

interface Website {
  id:           string
  domain:       string
  display_name: string | null
  integrations: WebsiteIntegration[]
}

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Profile fields drive the greeting; everything else is best-effort.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const { data: websitesRaw } = await supabase.rpc('get_my_websites')
  const sites = (websitesRaw ?? []) as Website[]

  const firstSite = sites[0] ?? null
  const monitoredSiteIds = sites
    .filter(s => (s.integrations ?? []).some(i => i.key === 'betterstack'))
    .map(s => s.id)
  const uptimeMap = await fetchUptimeBySite(monitoredSiteIds)
  const firstUptime = firstSite ? uptimeMap.get(firstSite.id) ?? null : null

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const displayName = profile?.company_name ?? profile?.full_name ?? user?.email

  return (
    <div>
      <div className="mb-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Dashboard
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
          {greeting()}{displayName ? `, ${displayName}` : ''}
          <span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600 md:text-base">
          Here&apos;s an overview of your web presence.
        </p>
      </div>

      {firstSite && (
        <div className="mb-8 rounded-2xl border border-navy-100 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">
                Your website
              </p>
              <p className="truncate text-lg font-bold text-navy-900">
                {firstSite.display_name?.trim() || firstSite.domain}
              </p>
              <a
                href={`https://${firstSite.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition hover:text-brand-800"
              >
                {firstSite.domain}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <StatusPill status={firstUptime?.status ?? null} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuickLink
          href="/portal/analytics"
          icon={BarChart3}
          title="Analytics"
          description="Visitors, traffic sources and page views"
        />
        <QuickLink
          href="/portal/social"
          icon={Megaphone}
          title="What's on"
          description="Schedule and manage your social posts"
        />
        <QuickLink
          href="/portal/uptime"
          icon={Activity}
          title="Uptime"
          description={firstUptime?.uptime_percentage !== null && firstUptime?.uptime_percentage !== undefined
            ? `${firstUptime.uptime_percentage.toFixed(2)}% uptime this month`
            : 'Monitor your site availability'}
        />
        <QuickLink
          href="/portal/subscription"
          icon={CreditCard}
          title="Subscription"
          description="Manage your plan and billing"
        />
      </div>

      {!firstSite && (
        <div className="mt-8 rounded-2xl border border-dashed border-navy-200 bg-white/60 p-8 text-center">
          <p className="text-sm text-navy-600">
            Your site details haven&apos;t been set up yet.{' '}
            <a
              href="mailto:hello@woldsdigital.co.uk"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline hover:text-brand-800"
            >
              Get in touch
            </a>{' '}
            and we&apos;ll get you set up.
          </p>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: 'up' | 'down' | 'paused' | 'unknown' | null }) {
  const cfg =
    status === 'up'
      ? { label: 'Online', dot: 'bg-brand-500', text: 'text-brand-700', border: 'border-brand-100', bg: 'bg-brand-50' }
      : status === 'down'
      ? { label: 'Offline', dot: 'bg-red-500', text: 'text-red-700', border: 'border-red-100', bg: 'bg-red-50' }
      : { label: 'Status unknown', dot: 'bg-navy-300', text: 'text-navy-600', border: 'border-navy-100', bg: 'bg-white' }

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function QuickLink({
  href, icon: Icon, title, description,
}: {
  href:        string
  icon:        React.ElementType
  title:       string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition group-hover:bg-brand-100">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy-900">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-navy-500">{description}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
    </Link>
  )
}
