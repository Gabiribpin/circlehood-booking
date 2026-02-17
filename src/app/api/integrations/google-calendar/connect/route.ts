import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/integrations/google-calendar';

/**
 * Inicia fluxo OAuth do Google Calendar
 * Redireciona para página de autorização do Google
 */
export async function GET() {
  try {
    const authUrl = getAuthUrl();

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
