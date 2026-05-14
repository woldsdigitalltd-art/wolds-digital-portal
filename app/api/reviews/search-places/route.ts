import { NextResponse, type NextRequest } from 'next/server'
import { searchPlaces } from '@/lib/services/google-places'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = request.nextUrl.searchParams.get('q')
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    const sr = createServiceRoleClient()
    const { data: integration } = await sr
      .from('integrations')
      .select('input_values')
      .eq('key', 'google_places')
      .maybeSingle()

    const apiKey = (integration?.input_values as Record<string, string> | null)?.api_key
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Places API key is not configured.' }, { status: 503 })
    }

    const results = await searchPlaces(apiKey, query)
    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
