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
    <div className="relative h-full w-[var(--sidebar-width)] shrink-0">
      <aside
        className="
          group absolute inset-y-0 left-0 z-30
          flex h-full overflow-hidden
          w-[var(--sidebar-width)] hover:w-[var(--sidebar-expanded-width)]
          transition-[width] duration-300 ease-out
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

        <div className="flex h-full w-[var(--sidebar-expanded-width)] flex-col">
          {/* Brand */}
          <div className="border-b border-white/40 px-4 py-5">
            <Link href="/portal" className="flex items-center gap-3">
              <Image
                src="/wolds-digital-logo.png"
                alt="Wolds Digital"
                width={1254}
                height={1254}
                priority
                className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-white/60 shadow-sm"
              />
              <div className="min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
                  title={label}
                  className={`
                    group/item relative flex items-center gap-3 rounded-full px-4 py-2.5
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
                      active ? 'text-brand-300' : 'text-navy-500 group-hover/item:text-navy-700'
                    }`}
                  />
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {label}
                  </span>
                </Link>
              )
            })}

          </nav>

          {/* User footer */}
          <div className="border-t border-white/40 px-3 py-4">
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-transparent px-2.5 py-2 ring-0 transition group-hover:bg-white/50 group-hover:ring-1 group-hover:ring-white/60">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100/80 text-xs font-bold text-brand-800 ring-1 ring-white/60">
                {initials}
              </div>
              <div className="min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <p className="truncate text-sm font-semibold text-navy-900 leading-tight">
                  {company ?? name ?? 'My Account'}
                </p>
                <p className="truncate text-xs text-navy-500 leading-tight mt-0.5">{email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-navy-600 transition hover:bg-white/60 hover:text-navy-900"
            >
              <LogOut className="h-4 w-4 shrink-0 text-navy-400" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Sign out
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
