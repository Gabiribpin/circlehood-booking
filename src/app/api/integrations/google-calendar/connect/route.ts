import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/integrations/google-calendar';
import { createClient } from '@/lib/supabase/server';

/**
 * Inicia fluxo OAuth do Google Calendar
 * Redireciona para página de autorização do Google
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUrl = getAuthUrl();

    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
