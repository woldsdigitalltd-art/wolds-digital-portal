'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  Boxes,
  User,
  LogOut,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { href: '/admin',              label: 'Overview',     icon: LayoutDashboard, exact: true },
  { href: '/admin/customers',    label: 'Customers',    icon: Users },
  { href: '/admin/integrations', label: 'Integrations', icon: Boxes },
  { href: '/admin/account',      label: 'My Account',   icon: User },
]

interface AdminSidebarProps {
  email: string
}

export default function AdminSidebar({ email }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative h-full w-[var(--sidebar-width)] shrink-0">
      <aside
        className="
          absolute inset-y-0 left-0 z-30
          flex h-full w-[var(--sidebar-width)]
          bg-white/70 backdrop-blur-sm border-r border-navy-100
        "
      >
        <div className="flex h-full w-full flex-col">
          {/* Brand */}
          <div className="flex justify-center border-b border-navy-100 py-5">
            <Link href="/admin" className="block">
              <Image
                src="/wolds-digital-logo.png"
                alt="Wolds Digital"
                width={1254}
                height={1254}
                priority
                className="h-10 w-10 rounded-lg"
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
                  className={`group/item flex h-10 w-fit items-center rounded-full px-3 text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-navy-900 text-white shadow-soft'
                      : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-brand-300' : 'text-navy-400 group-hover/item:text-navy-600'
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
          <div className="flex flex-col items-start gap-2 border-t border-navy-100 py-4 pl-4">
            <div className="flex h-10 w-10 items-center justify-center">
              <div
                title={email}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100/80 text-xs font-bold text-brand-800 ring-1 ring-white/60"
              >
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="group/item flex h-10 w-fit items-center rounded-full px-3 text-sm font-medium text-navy-600 transition-all duration-200 hover:bg-navy-50 hover:text-navy-900"
            >
              <LogOut className="h-4 w-4 shrink-0 text-navy-400 transition group-hover/item:text-navy-600" />
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
