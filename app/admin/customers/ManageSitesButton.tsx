import Link from 'next/link'
import { Globe } from 'lucide-react'

interface Props {
  customerId:    string
  customerEmail: string
  customerName:  string | null
  initialCount:  number
}

export default function ManageSitesButton({
  customerId, initialCount,
}: Props) {
  return (
    <Link
      href={`/admin/customers/${customerId}/sites`}
      className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      <Globe className="h-3 w-3 text-navy-400" />
      {initialCount}
      <span className="text-navy-400">·</span>
      Manage
    </Link>
  )
}
