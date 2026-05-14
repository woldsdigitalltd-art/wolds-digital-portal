'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Boxes,
  CreditCard,
  Gauge,
  LayoutDashboard,
  SearchCheck,
  Unlink,
} from 'lucide-react'

interface NavItem {
  href:   string
  label:  string
  icon:   React.ElementType
  exact?: boolean
}

interface Props {
  customerId:     string
  siteId:         string
  hasSeo:         boolean
  hasMonitor:     boolean
  hasPageSpeed:   boolean
  hasBrokenLinks: boolean
  hasStripe:      boolean
}

export default function Subnav({
  customerId, siteId,
  hasSeo, hasMonitor, hasPageSpeed, hasBrokenLinks, hasStripe,
}: Props) {
  const pathname = usePathname()
  const base     = `/admin/customers/${customerId}/sites/${siteId}`

  const items: NavItem[] = [
    { href: base,                 label: 'Dashboard',         icon: LayoutDashboard, exact: true },
    ...(hasSeo
      ? [{ href: `${base}/seo`,          label: 'SEO',               icon: SearchCheck } as NavItem]
      : []),
    ...(hasPageSpeed
      ? [{ href: `${base}/performance`,  label: 'Performance',       icon: Gauge       } as NavItem]
      : []),
    ...(hasBrokenLinks
      ? [{ href: `${base}/broken-links`, label: 'Broken Link Checker', icon: Unlink     } as NavItem]
      : []),
    ...(hasMonitor
      ? [{ href: `${base}/monitoring`,   label: 'Monitoring',        icon: Activity    } as NavItem]
      : []),
    { href: `${base}/services`,   label: 'Services',          icon: Boxes },
    ...(hasStripe
      ? [{ href: `${base}/billing`,      label: 'Billing',           icon: CreditCard  } as NavItem]
      : []),
  ]

  return (
    <aside
      className="
        sticky top-0 hidden h-screen w-56 shrink-0 self-start
        flex-col border-r border-navy-100 bg-white/70 backdrop-blur-sm
        lg:flex
      "
    >
      <nav className="flex flex-col gap-1 p-3 pt-6">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          const isServices = label === 'Services'
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 rounded-xl px-3.5 py-2.5
                text-sm font-semibold transition
                ${isServices && !active ? 'mt-2 border-t border-navy-100 pt-3.5' : ''}
                ${active
                  ? 'bg-navy-900 text-white shadow-[0_4px_14px_-4px_rgba(11,37,69,0.35)]'
                  : 'text-navy-700 hover:bg-navy-50 hover:text-navy-900'}
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
