'use client'

import Link from 'next/link'
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
  Globe,
} from 'lucide-react'

const navItems = [
  { href: '/portal',              label: 'Dashboard',   icon: LayoutDashboard, exact: true },
  { href: '/portal/analytics',    label: 'Analytics',   icon: BarChart3 },
  { href: '/portal/social',       label: "What's on",   icon: Megaphone },
  { href: '/portal/uptime',       label: 'Uptime',      icon: Activity },
  { href: '/portal/account',      label: 'Account',     icon: User },
  { href: '/portal/subscription', label: 'Subscription',icon: CreditCard },
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

  return (
    <aside className="w-64 shrink-0 bg-slate-900 flex flex-col h-full border-r border-slate-800">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">Wolds Digital</p>
            <p className="text-slate-500 text-xs leading-tight">Client Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-brand-500/15 text-brand-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brand-400' : ''}`} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="px-3 py-2 mb-1">
          <p className="text-slate-200 text-sm font-medium truncate leading-tight">
            {company ?? name ?? 'My Account'}
          </p>
          <p className="text-slate-500 text-xs truncate mt-0.5">{email}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
