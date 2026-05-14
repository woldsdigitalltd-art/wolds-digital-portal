import { NextResponse, type NextRequest } from 'next/server'
import { updateSiteReviewConfig } from '@/lib/services/review-monitor'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { siteId, googlePlaceId, trustpilotDomain, reviewTrackingMode } =
      await request.json()

    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 })
    }

    await updateSiteReviewConfig({
      siteId,
      googlePlaceId,
      trustpilotDomain,
      reviewTrackingMode,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
