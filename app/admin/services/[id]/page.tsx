import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptJSON } from '@/lib/crypto'
import { normalizeSchema, type ServiceDetail } from '@/lib/services/types'
import ServiceEditor from './ServiceEditor'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminServiceDetailPage({ params }: PageProps) {
  const { id } = await params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('services')
    .select(`
      id, key, name, description, icon, enabled, sort_order,
      created_at, updated_at,
      global_settings_schema, global_settings_data, user_settings_schema
    `)
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

  let globalData: Record<string, unknown> | null = null
  let decryptError: string | null = null
  try {
    globalData = decryptJSON<Record<string, unknown>>(data.global_settings_data)
  } catch (err) {
    decryptError = err instanceof Error ? err.message : 'Decryption failed.'
  }

  const service: ServiceDetail = {
    id:          data.id,
    key:         data.key,
    name:        data.name,
    description: data.description,
    icon:        data.icon,
    enabled:     data.enabled,
    sort_order:  data.sort_order,
    has_global_settings: Boolean(data.global_settings_data),
    has_user_settings:   Boolean(data.user_settings_schema),
    created_at:  data.created_at,
    updated_at:  data.updated_at,
    global_settings_schema: normalizeSchema(data.global_settings_schema),
    user_settings_schema:   normalizeSchema(data.user_settings_schema),
    global_settings_data:   globalData,
  }

  return (
    <div>
      <BackLink />
      <ServiceEditor initialService={service} decryptError={decryptError} />
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
