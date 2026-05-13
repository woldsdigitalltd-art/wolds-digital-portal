import { NextResponse, type NextRequest } from 'next/server'
import { raiseSubscription } from '@/lib/services/billing'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ownerId, siteId, monthlyAmountInPounds, startDate } =
      await request.json()

    if (!ownerId || !siteId || !monthlyAmountInPounds) {
      return NextResponse.json(
        { error: 'ownerId, siteId and monthlyAmountInPounds are required' },
        { status: 400 }
      )
    }

    const monthlyAmountInPence = Math.round(
      parseFloat(monthlyAmountInPounds) * 100
    )
    if (monthlyAmountInPence < 100) {
      return NextResponse.json(
        { error: 'Minimum monthly amount is £1.00' },
        { status: 400 }
      )
    }

    await raiseSubscription({
      ownerId,
      siteId,
      monthlyAmountInPence,
      startDate: startDate ? new Date(startDate) : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
