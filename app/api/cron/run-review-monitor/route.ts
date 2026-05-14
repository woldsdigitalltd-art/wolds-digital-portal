import { NextResponse } from 'next/server'
import {
  getSitesWithReviewConfig,
  runReviewCheckForSite,
} from '@/lib/services/review-monitor'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sites = await getSitesWithReviewConfig()

    if (sites.length === 0) {
      return NextResponse.json({ message: 'No sites configured for review monitoring' })
    }

    const results = await Promise.allSettled(
      sites.map(site => runReviewCheckForSite(site))
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({
      message: 'Review check complete',
      succeeded,
      failed,
      total: sites.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Review monitor cron failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
