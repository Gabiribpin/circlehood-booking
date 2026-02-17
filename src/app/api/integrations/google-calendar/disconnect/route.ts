import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Desconecta Google Calendar
 * Remove credenciais e desativa integração
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

    // Desativar e limpar credenciais
    const { error } = await supabase
      .from('integrations')
      .update({
        is_active: false,
        is_configured: false,
        credentials: {},
        updated_at: new Date().toISOString(),
      })
      .eq('professional_id', professional.id)
      .eq('integration_type', 'google_calendar');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Google Calendar disconnected successfully',
    });
  } catch (error: any) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      {
        error: 'Failed to disconnect Google Calendar',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
