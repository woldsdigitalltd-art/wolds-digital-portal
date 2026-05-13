'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Gauge,
  LayoutDashboard,
  SearchCheck,
  Unlink,
} from 'lucide-react'

interface SubnavItem {
  href:   string
  label:  string
  icon:   React.ElementType
  exact?: boolean
}

interface Props {
  siteId:           string
  hasSeo:           boolean
  hasMonitor:       boolean
  hasPageSpeed:     boolean
  hasBrokenLinks:   boolean
}

/**
 * Horizontal tabs under the per-site page header. The Dashboard tab
 * is always present; per-integration tabs only appear when that
 * integration is attached + active for the site.
 */
export default function Subnav({
  siteId, hasSeo, hasMonitor, hasPageSpeed, hasBrokenLinks,
}: Props) {
  const pathname = usePathname()
  const base     = `/portal/websites/${siteId}`

  const items: SubnavItem[] = [
    { href: base,                 label: 'Dashboard',    icon: LayoutDashboard, exact: true },
    ...(hasSeo
      ? [{ href: `${base}/seo`,          label: 'SEO',          icon: SearchCheck } as SubnavItem]
      : []),
    ...(hasPageSpeed
      ? [{ href: `${base}/performance`,  label: 'Performance',  icon: Gauge       } as SubnavItem]
      : []),
    ...(hasBrokenLinks
      ? [{ href: `${base}/broken-links`, label: 'Broken Links', icon: Unlink      } as SubnavItem]
      : []),
    ...(hasMonitor
      ? [{ href: `${base}/monitoring`,   label: 'Monitoring',   icon: Activity    } as SubnavItem]
      : []),
  ]

  return (
    <nav
      className="
        relative -mx-1 flex items-center gap-1 overflow-x-auto rounded-2xl
        border border-navy-100 bg-white/70 p-1 shadow-soft backdrop-blur-md
        scrollbar-hide
      "
    >
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`
              relative inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2
              text-xs font-semibold transition
              ${active
                ? 'bg-navy-900 text-white shadow-[0_4px_14px_-4px_rgba(11,37,69,0.35)]'
                : 'text-navy-700 hover:bg-white hover:text-navy-900'}
            `}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-brand-300' : 'text-navy-500'}`} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
