'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  BarChart3,
  Megaphone,
  Activity,
  User,
  CreditCard,
  LogOut,
} from 'lucide-react'

const navItems = [
  { href: '/portal',              label: 'Dashboard',    icon: LayoutDashboard, exact: true },
  { href: '/portal/analytics',    label: 'Analytics',    icon: BarChart3 },
  { href: '/portal/social',       label: "What's on",    icon: Megaphone },
  { href: '/portal/uptime',       label: 'Uptime',       icon: Activity },
  { href: '/portal/account',      label: 'Account',      icon: User },
  { href: '/portal/subscription', label: 'Subscription', icon: CreditCard },
]

interface SidebarProps {
  email: string
  name: string | null
  company: string | null
}

export default function Sidebar({ email, name, company }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials =
    (company ?? name ?? email).trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'W'

  return (
    <aside className="w-[var(--sidebar-width)] shrink-0 flex h-full flex-col border-r border-navy-100 bg-white/70 backdrop-blur-sm">
      {/* Brand */}
      <div className="border-b border-navy-100 px-5 py-5">
        <Link href="/portal" className="flex items-center gap-3">
          <Image
            src="/wolds-digital-logo.png"
            alt="Wolds Digital"
            width={1254}
            height={1254}
            priority
            className="h-10 w-10 shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight leading-tight">
              <span className="text-navy-900">Wolds</span>{' '}
              <span className="text-brand-500">Digital</span>
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-400 leading-tight mt-0.5">
              Client Portal
            </p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1 scrollbar-hide">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-navy-900 text-white shadow-soft'
                  : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? 'text-brand-300' : 'text-navy-400 group-hover:text-navy-600'
                }`}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-navy-100">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy-900 leading-tight">
              {company ?? name ?? 'My Account'}
            </p>
            <p className="truncate text-xs text-navy-500 leading-tight mt-0.5">{email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-navy-600 transition hover:bg-navy-50 hover:text-navy-900"
        >
          <LogOut className="h-4 w-4 text-navy-400" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
