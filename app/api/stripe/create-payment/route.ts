import { NextResponse, type NextRequest } from 'next/server'
import { raiseOneOffPayment } from '@/lib/services/billing'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ownerId, siteId, amountInPounds, description, daysUntilDue } =
      await request.json()

    if (!ownerId || !siteId || !amountInPounds || !description) {
      return NextResponse.json(
        { error: 'ownerId, siteId, amountInPounds and description are required' },
        { status: 400 }
      )
    }

    const amountInPence = Math.round(parseFloat(amountInPounds) * 100)
    if (amountInPence < 100) {
      return NextResponse.json(
        { error: 'Minimum amount is £1.00' },
        { status: 400 }
      )
    }

    const payment = await raiseOneOffPayment({
      ownerId,
      siteId,
      amountInPence,
      description,
      daysUntilDue: daysUntilDue ?? 7,
    })

    return NextResponse.json({ success: true, payment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
