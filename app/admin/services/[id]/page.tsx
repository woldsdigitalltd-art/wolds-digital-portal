import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ServiceWithAuth } from '@/lib/services/types'
import ServiceEditor from './ServiceEditor'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminServiceDetailPage({ params }: PageProps) {
  const { id } = await params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services_with_auth')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return (
      <div>
        <BackLink />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">Couldn&apos;t load service: {error.message}</p>
        </div>
      </div>
    )
  }
  if (!data) notFound()

  return (
    <div>
      <BackLink />
      <ServiceEditor initialService={data as ServiceWithAuth} />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/admin/services"
      className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500 transition hover:text-brand-700"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to services
    </Link>
  )
}
