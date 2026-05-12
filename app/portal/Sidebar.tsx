'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Globe,
  User,
  Bell,
  LogOut,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { href: '/portal',               label: 'Dashboard',     icon: LayoutDashboard, exact: true },
  { href: '/portal/websites',      label: 'Websites',      icon: Globe },
  { href: '/portal/account',       label: 'Account',       icon: User },
  { href: '/portal/notifications', label: 'Notifications', icon: Bell },
]

interface SidebarProps {
  email: string
  name: string | null
  company: string | null
  isAdmin?: boolean
}

export default function Sidebar({ email, name, company, isAdmin = false }: SidebarProps) {
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
    <aside
      className="
        relative w-[var(--sidebar-width)] shrink-0 flex h-full flex-col
        bg-white/40 backdrop-blur-2xl backdrop-saturate-150
        border-r border-white/60
        shadow-[inset_-1px_0_0_rgba(255,255,255,0.5),1px_0_24px_-12px_rgba(11,37,69,0.12)]
      "
    >
      {/* subtle inner highlight along the top edge to sell the glass */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
      />

      {/* Brand */}
      <div className="border-b border-white/40 px-5 py-5">
        <Link href="/portal" className="flex items-center gap-3">
          <Image
            src="/wolds-digital-logo.png"
            alt="Wolds Digital"
            width={1254}
            height={1254}
            priority
            className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-white/60 shadow-sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight leading-tight">
              <span className="text-navy-900">Wolds</span>{' '}
              <span className="text-brand-600">Digital</span>
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-500 leading-tight mt-0.5">
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
              className={`
                group relative flex items-center gap-3 rounded-full px-4 py-2.5
                text-sm font-medium transition
                ${
                  active
                    ? 'bg-navy-900 text-white shadow-[0_4px_14px_-4px_rgba(11,37,69,0.35)]'
                    : 'text-navy-700 hover:bg-white/60 hover:text-navy-900 hover:shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_2px_8px_-4px_rgba(11,37,69,0.08)]'
                }
              `}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition ${
                  active ? 'text-brand-300' : 'text-navy-500 group-hover:text-navy-700'
                }`}
              />
              {label}
            </Link>
          )
        })}

        {isAdmin && (
          <div className="pt-4">
            <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-500">
              Internal
            </p>
            <Link
              href="/admin"
              className="group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-navy-700 transition hover:bg-brand-50/70 hover:text-brand-800"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
              Admin
            </Link>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/40 px-3 py-4">
        <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/50 px-2.5 py-2 ring-1 ring-white/60">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100/80 text-xs font-bold text-brand-800 ring-1 ring-white/60">
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
          className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-navy-600 transition hover:bg-white/60 hover:text-navy-900"
        >
          <LogOut className="h-4 w-4 text-navy-400" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
