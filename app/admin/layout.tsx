import { requireAdmin } from '@/lib/auth/admin-guard'
import AdminSidebar from './AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { email } = await requireAdmin()

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar email={email} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-10 md:px-8 md:py-12">
          {children}
        </div>
      </main>
    </div>
  )
}
