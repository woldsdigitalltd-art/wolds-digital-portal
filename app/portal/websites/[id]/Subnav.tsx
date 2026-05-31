'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  CreditCard,
  LayoutDashboard,
  SearchCheck,
  Star,
  Unlink,
} from 'lucide-react'

interface NavItem {
  href:   string
  label:  string
  icon:   React.ElementType
  exact?: boolean
}

interface Props {
  siteId:              string
  hasSeo:              boolean
  hasMonitor:          boolean
  hasBrokenLinks:      boolean
  hasStripe:           boolean
  hasReviewMonitor:    boolean
}

export default function Subnav({
  siteId, hasSeo, hasMonitor, hasBrokenLinks, hasStripe, hasReviewMonitor,
}: Props) {
  const pathname = usePathname()
  const base     = `/portal/websites/${siteId}`

  const items: NavItem[] = [
    { href: base,                 label: 'Dashboard',          icon: LayoutDashboard, exact: true },
    ...(hasSeo
      ? [{ href: `${base}/seo`,          label: 'SEO',                icon: SearchCheck } as NavItem]
      : []),
    ...(hasBrokenLinks
      ? [{ href: `${base}/broken-links`, label: 'Broken Link Checker', icon: Unlink      } as NavItem]
      : []),
    ...(hasMonitor
      ? [{ href: `${base}/monitoring`,   label: 'Monitoring',         icon: Activity    } as NavItem]
      : []),
    ...(hasReviewMonitor
      ? [{ href: `${base}/reviews`,      label: 'Review Monitoring',  icon: Star        } as NavItem]
      : []),
    ...(hasStripe
      ? [{ href: '/portal/billing',      label: 'Billing',            icon: CreditCard  } as NavItem]
      : []),
  ]

  return (
    <aside
      className="
        sticky top-0 hidden h-screen w-56 shrink-0 self-start
        flex-col border-r border-white/60
        bg-white/40 backdrop-blur-xl backdrop-saturate-150
        shadow-[inset_-1px_0_0_rgba(255,255,255,0.5),1px_0_24px_-12px_rgba(11,37,69,0.12)]
        lg:flex
      "
    >
      <nav className="flex flex-col gap-1 p-3 pt-6">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 rounded-xl px-3.5 py-2.5
                text-sm font-semibold transition
                ${active
                  ? 'bg-navy-900 text-white shadow-[0_4px_14px_-4px_rgba(11,37,69,0.35)]'
                  : 'text-navy-700 hover:bg-white/60 hover:text-navy-900'}
              `}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brand-300' : 'text-navy-500'}`} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
