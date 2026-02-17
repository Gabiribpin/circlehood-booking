import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForToken, getLongLivedToken, getUserProfile } from '@/lib/integrations/instagram'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/login?error=unauthorized`
    )
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?error=instagram_auth_failed`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?error=no_code`
    )
  }

  try {
    const config = {
      clientId: process.env.INSTAGRAM_CLIENT_ID!,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/instagram/callback`
    }

    // Trocar code por short-lived token
    const { accessToken: shortToken, userId } = await exchangeCodeForToken(code, config)

    // Trocar por long-lived token (60 dias)
    const { accessToken: longToken, expiresIn } = await getLongLivedToken(
      shortToken,
      config.clientSecret
    )

    // Buscar perfil do usuário
    const profile = await getUserProfile(userId, longToken)

    // Calcular data de expiração
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn)

    // Salvar integração no banco
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert({
        professional_id: user.id,
        type: 'instagram',
        access_token: longToken,
        refresh_token: null,
        token_expires_at: expiresAt.toISOString(),
        instagram_user_id: userId,
        instagram_username: profile.username,
        is_active: true,
        metadata: {
          account_type: profile.accountType,
          media_count: profile.mediaCount,
          connected_at: new Date().toISOString()
        }
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?error=database_error`
      )
    }

    // Redirecionar para página de integrações com sucesso
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?success=instagram_connected`
    )
  } catch (error: any) {
    console.error('Instagram OAuth error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/integrations?error=${encodeURIComponent(error.message)}`
    )
  }
}
