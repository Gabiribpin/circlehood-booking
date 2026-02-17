import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizationUrl } from '@/lib/integrations/instagram'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = {
    clientId: process.env.INSTAGRAM_CLIENT_ID!,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
    redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/instagram/callback`
  }

  if (!config.clientId || !config.clientSecret) {
    return NextResponse.json(
      { error: 'Instagram integration not configured' },
      { status: 500 }
    )
  }

  const authUrl = getAuthorizationUrl(config)

  return NextResponse.redirect(authUrl)
}
