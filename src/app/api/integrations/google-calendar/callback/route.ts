import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTokensFromCode } from '@/lib/integrations/google-calendar';

/**
 * Callback do OAuth Google Calendar
 * Recebe code e troca por access_token + refresh_token
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Se usuário negou acesso
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/integrations?error=${encodeURIComponent('Google Calendar authorization denied')}`,
        request.url
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/integrations?error=${encodeURIComponent('No authorization code received')}`,
        request.url
      )
    );
  }

  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?redirect=/integrations', request.url)
      );
    }

    // Buscar professional_id
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.redirect(
        new URL('/onboarding?redirect=/integrations', request.url)
      );
    }

    // Trocar code por tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get tokens from Google');
    }

    // Salvar tokens no banco (encriptados - TODO: adicionar encriptação)
    const { error: dbError } = await supabase.from('integrations').upsert(
      {
        professional_id: professional.id,
        integration_type: 'google_calendar',
        is_active: true,
        is_configured: true,
        credentials: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          scope: tokens.scope,
          token_type: tokens.token_type,
        },
        settings: {
          calendar_id: 'primary',
          auto_sync: true,
        },
        last_sync_at: new Date().toISOString(),
      },
      {
        onConflict: 'professional_id,integration_type',
      }
    );

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save integration');
    }

    // Redirecionar para página de integrações com sucesso
    return NextResponse.redirect(
      new URL(
        '/integrations?success=google_calendar_connected',
        request.url
      )
    );
  } catch (error) {
    console.error('Error in Google Calendar callback:', error);
    return NextResponse.redirect(
      new URL(
        `/integrations?error=${encodeURIComponent('Failed to connect Google Calendar')}`,
        request.url
      )
    );
  }
}
