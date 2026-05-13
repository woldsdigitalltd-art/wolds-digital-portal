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
          absolute inset-y-0 left-0 z-30
          flex h-full w-[var(--sidebar-width)]
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

        <div className="flex h-full w-full flex-col">
          {/* Brand */}
          <div className="flex justify-center border-b border-white/40 py-5">
            <Link href="/portal" className="block">
              <Image
                src="/wolds-digital-logo.png"
                alt="Wolds Digital"
                width={1254}
                height={1254}
                priority
                className="h-10 w-10 rounded-lg ring-1 ring-white/60 shadow-sm"
              />
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex flex-1 flex-col items-start gap-1 py-5 pl-4">
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`
                    group/item flex h-10 w-fit items-center rounded-full px-3
                    text-sm font-medium transition-all duration-200
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
                  <span className="max-w-0 overflow-hidden whitespace-nowrap transition-[max-width,margin] duration-200 ease-out group-hover/item:ml-3 group-hover/item:max-w-xs">
                    {label}
                  </span>
                </Link>
              )
            })}
          </nav>

          {/* User footer */}
          <div className="flex flex-col items-start gap-2 border-t border-white/40 py-4 pl-4">
            <div className="flex h-10 w-10 items-center justify-center">
              <div
                title={`${company ?? name ?? 'My Account'}\n${email}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100/80 text-xs font-bold text-brand-800 ring-1 ring-white/60"
              >
                {initials}
              </div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="group/item flex h-10 w-fit items-center rounded-full px-3 text-sm font-medium text-navy-600 transition-all duration-200 hover:bg-white/60 hover:text-navy-900"
            >
              <LogOut className="h-4 w-4 shrink-0 text-navy-400 transition group-hover/item:text-navy-700" />
              <span className="max-w-0 overflow-hidden whitespace-nowrap transition-[max-width,margin] duration-200 ease-out group-hover/item:ml-3 group-hover/item:max-w-xs">
                Sign out
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
