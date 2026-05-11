import { createClient } from '@/lib/supabase/server'
import { BarChart3, Activity, Megaphone, CreditCard, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: portalData } = await supabase
    .rpc('get_my_portal_data')

  const profile   = portalData?.profile
  const sites     = portalData?.sites ?? []
  const sub       = portalData?.subscription
  const firstSite = sites[0]?.site
  const uptime    = sites[0]?.uptime

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const displayName = profile?.company_name ?? profile?.full_name ?? user?.email

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          {greeting()}{displayName ? `, ${displayName}` : ''}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Here&apos;s an overview of your web presence.
        </p>
      </div>

      {/* Site info banner */}
      {firstSite && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Your website</p>
            <p className="text-slate-900 font-medium">{firstSite.display_name}</p>
            <a
              href={`https://${firstSite.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:text-brand-700 transition"
            >
              {firstSite.domain} ↗
            </a>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            uptime?.status === 'up'
              ? 'bg-green-50 text-green-700'
              : uptime?.status === 'down'
              ? 'bg-red-50 text-red-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              uptime?.status === 'up' ? 'bg-green-500' :
              uptime?.status === 'down' ? 'bg-red-500' : 'bg-slate-400'
            }`} />
            {uptime?.status === 'up' ? 'Online' : uptime?.status === 'down' ? 'Offline' : 'Status unknown'}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <QuickLink
          href="/portal/analytics"
          icon={BarChart3}
          title="Analytics"
          description="Visitors, traffic sources and page views"
          color="blue"
        />
        <QuickLink
          href="/portal/social"
          icon={Megaphone}
          title="What's on"
          description="Schedule and manage your social posts"
          color="amber"
        />
        <QuickLink
          href="/portal/uptime"
          icon={Activity}
          title="Uptime"
          description={uptime?.uptime_percentage
            ? `${uptime.uptime_percentage}% uptime this month`
            : 'Monitor your site availability'}
          color="green"
        />
        <QuickLink
          href="/portal/subscription"
          icon={CreditCard}
          title="Subscription"
          description={sub?.plan
            ? `${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} plan — ${sub.status}`
            : 'Manage your plan and billing'}
          color="purple"
        />
      </div>

      {/* No site yet */}
      {!firstSite && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <p className="text-slate-500 text-sm">
            Your site details haven&apos;t been set up yet.{' '}
            <a href="mailto:hello@woldsdigital.com" className="text-brand-600 hover:underline">
              Get in touch
            </a>{' '}
            with us and we&apos;ll get you set up.
          </p>
        </div>
      )}
    </div>
  )
}

function QuickLink({
  href, icon: Icon, title, description, color,
}: {
  href: string
  icon: React.ElementType
  title: string
  description: string
  color: 'blue' | 'amber' | 'green' | 'purple'
}) {
  const colours = {
    blue:   'bg-blue-50 text-blue-600',
    amber:  'bg-amber-50 text-amber-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <Link
      href={href}
      className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all flex items-start gap-4"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colours[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 font-medium text-sm">{title}</p>
        <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0 mt-0.5 transition" />
    </Link>
  )
}
