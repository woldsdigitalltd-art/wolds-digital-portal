'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  Boxes,
  ArrowLeftRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { href: '/admin',           label: 'Overview',  icon: LayoutDashboard, exact: true },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/integrations', label: 'Integrations', icon: Boxes },
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
    <aside className="w-[var(--sidebar-width)] shrink-0 flex h-full flex-col border-r border-navy-100 bg-white/70 backdrop-blur-sm">
      {/* Brand */}
      <div className="border-b border-navy-100 px-5 py-5">
        <Link href="/admin" className="flex items-center gap-3">
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
            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700 leading-tight">
              <ShieldCheck className="h-3 w-3" />
              Admin
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

        <div className="pt-4">
          <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-400">
            Switch view
          </p>
          <Link
            href="/portal"
            className="group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-navy-600 transition hover:bg-navy-50 hover:text-navy-900"
          >
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-navy-400 group-hover:text-navy-600" />
            Client view
          </Link>
        </div>
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-navy-100">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-semibold text-navy-900 leading-tight">
            Signed in as
          </p>
          <p className="truncate text-xs text-navy-500 leading-tight mt-0.5">{email}</p>
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
