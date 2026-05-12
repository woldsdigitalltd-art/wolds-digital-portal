import { Bell, Mail, AlertTriangle } from 'lucide-react'

export default function NotificationsPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Inbox
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900 md:text-4xl">
          Notifications<span className="text-brand-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-navy-600 md:text-base">
          Site alerts, billing updates and anything else we need to flag for you.
        </p>
      </div>

      <div className="rounded-2xl border border-white/60 bg-white/60 p-10 text-center shadow-soft backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Bell className="h-7 w-7" />
        </div>
        <p className="text-base font-semibold text-navy-900">You&apos;re all caught up</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-navy-600">
          When something needs your attention — like a site going offline or an invoice ready
          to view — it&apos;ll show up here.
        </p>
      </div>

      {/* Preview of what notification types will look like once they're wired up */}
      <div className="mt-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-500">
          What you&apos;ll see here
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Preview
            icon={AlertTriangle}
            tint="amber"
            title="Site alerts"
            description="If one of your sites goes down or recovers, you'll know straight away."
          />
          <Preview
            icon={Mail}
            tint="navy"
            title="Account updates"
            description="Profile changes, sign-in activity and security-related events."
          />
          <Preview
            icon={Bell}
            tint="brand"
            title="Service updates"
            description="New portal features, scheduled maintenance and seasonal notes."
          />
        </div>
      </div>
    </div>
  )
}

function Preview({
  icon: Icon,
  tint,
  title,
  description,
}: {
  icon: React.ElementType
  tint: 'amber' | 'navy' | 'brand'
  title: string
  description: string
}) {
  const styles = {
    amber: { bg: 'bg-amber-50/70',  ring: 'ring-amber-100',  text: 'text-amber-700' },
    navy:  { bg: 'bg-navy-50/80',   ring: 'ring-navy-100',   text: 'text-navy-700' },
    brand: { bg: 'bg-brand-50/80',  ring: 'ring-brand-100',  text: 'text-brand-700' },
  }[tint]

  return (
    <div className="rounded-2xl border border-white/60 bg-white/50 p-4 backdrop-blur-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${styles.bg} ${styles.ring} ${styles.text}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-navy-500">{description}</p>
    </div>
  )
}
