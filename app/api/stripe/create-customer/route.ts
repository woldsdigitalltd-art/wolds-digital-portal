import { NextResponse, type NextRequest } from 'next/server'
import { provisionStripeCustomer } from '@/lib/services/billing'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ownerId } = await request.json()
    if (!ownerId) {
      return NextResponse.json({ error: 'ownerId is required' }, { status: 400 })
    }

    await provisionStripeCustomer(ownerId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
