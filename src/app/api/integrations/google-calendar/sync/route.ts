import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fullSync } from '@/lib/integrations/google-calendar';

/**
 * Sincronização manual do Google Calendar
 * Sincroniza bidirecional: CircleHood ↔ Google
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar professional
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json(
        { error: 'Professional not found' },
        { status: 404 }
      );
    }

    // Verificar se Google Calendar está conectado
    const { data: integration } = await supabase
      .from('integrations')
      .select('is_configured')
      .eq('professional_id', professional.id)
      .eq('integration_type', 'google_calendar')
      .single();

    if (!integration?.is_configured) {
      return NextResponse.json(
        { error: 'Google Calendar not connected' },
        { status: 400 }
      );
    }

    // Executar sincronização completa
    const result = await fullSync(professional.id);

    return NextResponse.json({
      success: true,
      message: 'Synchronization completed successfully',
      result,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        error: 'Synchronization failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
