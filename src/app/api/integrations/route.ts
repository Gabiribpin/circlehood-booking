import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Lista todas as integrações do profissional
 * GET /api/integrations
 */
export async function GET() {
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

    // Buscar todas as integrações
    const { data: integrations } = await supabase
      .from('integrations')
      .select('integration_type, is_active, is_configured, last_sync_at, last_error, settings')
      .eq('professional_id', professional.id);

    // Transformar array em objeto indexado por tipo
    const integrationsMap: Record<string, any> = {};

    integrations?.forEach((integration) => {
      integrationsMap[integration.integration_type] = {
        is_active: integration.is_active,
        is_configured: integration.is_configured,
        last_sync_at: integration.last_sync_at,
        last_error: integration.last_error,
        settings: integration.settings,
      };
    });

    return NextResponse.json(integrationsMap);
  } catch (error: any) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch integrations',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
