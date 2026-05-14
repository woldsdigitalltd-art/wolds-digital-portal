import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { AlertTriangle, Info, CheckCircle, XCircle, MessageCircle } from 'lucide-react'
import type { Incident, IncidentComment, IncidentSeverity, IncidentStatus } from '@/lib/incidents/types'
import CommentForm from './CommentForm'

interface SiteRow { id: string; display_name: string | null; domain: string }

type Params = { params: Promise<{ id: string }> }

export default async function IncidentDetailPage({ params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const sr = createServiceRoleClient()
  const { data: incident } = await sr.from('incidents').select('*').eq('id', id).maybeSingle()
  if (!incident) notFound()

  const { data: site } = await sr.from('sites').select('id, display_name, domain, owner_id').eq('id', incident.site_id).maybeSingle()
  if (!site || site.owner_id !== user.id) notFound()

  const { data: commentsRaw } = await sr
    .from('incident_comments')
    .select('*')
    .eq('incident_id', id)
    .order('created_at', { ascending: true })

  const inc      = incident as Incident
  const siteRow  = site as SiteRow
  const comments = (commentsRaw ?? []) as IncidentComment[]

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Incident
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 md:text-3xl">
          {inc.title}
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          {siteRow.display_name ?? siteRow.domain}
        </p>
      </div>

      {/* Status & severity badges */}
      <div className="mb-6 flex flex-wrap gap-2">
        <SeverityBadge severity={inc.severity} />
        <StatusBadge status={inc.status} />
        <span className="rounded-full bg-white/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-navy-500 ring-1 ring-white/60">
          {inc.integration_key}
        </span>
      </div>

      {/* Description */}
      <div className="mb-6 rounded-2xl border border-white/60 bg-white/60 px-5 py-4 shadow-soft backdrop-blur-sm">
        <p className="text-sm leading-relaxed text-navy-700">{inc.description}</p>
        <p className="mt-3 text-xs text-navy-400">
          Opened {new Date(inc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        {inc.resolved_at && (
          <p className="mt-1 text-xs text-navy-400">
            {inc.status === 'dismissed' ? 'Dismissed' : 'Resolved'}{' '}
            {new Date(inc.resolved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {inc.dismiss_reason ? ` — ${inc.dismiss_reason}` : ''}
          </p>
        )}
      </div>

      {/* Comment thread */}
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-navy-400" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-500">
          Comments {comments.length > 0 ? `(${comments.length})` : ''}
        </p>
      </div>

      {comments.length > 0 && (
        <ul className="mb-4 flex flex-col gap-3">
          {comments.map(comment => (
            <CommentBubble key={comment.id} comment={comment} currentUserId={user.id} />
          ))}
        </ul>
      )}

      {inc.status === 'open' && (
        <CommentForm incidentId={id} />
      )}

      {inc.status !== 'open' && (
        <p className="text-center text-xs text-navy-400">
          This incident is {inc.status}. Comments are read-only.
        </p>
      )}
    </div>
  )
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  if (severity === 'critical') return (
    <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-700">
      <AlertTriangle className="h-3 w-3" /> Critical
    </span>
  )
  if (severity === 'warning') return (
    <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
      <AlertTriangle className="h-3 w-3" /> Warning
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
      <Info className="h-3 w-3" /> Info
    </span>
  )
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  if (status === 'resolved') return (
    <span className="flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
      <CheckCircle className="h-3 w-3" /> Resolved
    </span>
  )
  if (status === 'dismissed') return (
    <span className="flex items-center gap-1.5 rounded-full bg-navy-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-navy-600">
      <XCircle className="h-3 w-3" /> Dismissed
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
      <AlertTriangle className="h-3 w-3" /> Open
    </span>
  )
}

function CommentBubble({
  comment,
  currentUserId,
}: {
  comment:       IncidentComment
  currentUserId: string
}) {
  const isOwn    = comment.author_id === currentUserId
  const isAdmin  = comment.author_role === 'admin'
  const dateStr  = new Date(comment.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <li className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-sm rounded-2xl px-4 py-3 text-sm shadow-soft ${
        isOwn
          ? 'bg-navy-900 text-white'
          : isAdmin
            ? 'bg-brand-50 text-navy-900 ring-1 ring-brand-100'
            : 'bg-white/70 text-navy-900 ring-1 ring-white/60 backdrop-blur-sm'
      }`}>
        {isAdmin && !isOwn && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-600">Wolds Digital</p>
        )}
        <p className="leading-relaxed">{comment.body}</p>
        <p className={`mt-1.5 text-[10px] ${isOwn ? 'text-white/60' : 'text-navy-400'}`}>{dateStr}</p>
      </div>
    </li>
  )
}
