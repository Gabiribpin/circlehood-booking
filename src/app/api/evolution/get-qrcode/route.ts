import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/integrations/token-encryption';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const instanceRaw = request.nextUrl.searchParams.get('instance');
    if (!instanceRaw || !/^[a-zA-Z0-9_-]+$/.test(instanceRaw)) {
      return NextResponse.json({ error: 'Invalid instance name' }, { status: 400 });
    }
    const instance = instanceRaw;

    // Buscar token da instância no Supabase
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('evolution_api_url, evolution_api_key, evolution_instance')
      .eq('user_id', user.id)
      .single();

    if (!config?.evolution_api_key) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    // Validate instance belongs to this user
    if (config.evolution_instance !== instance) {
      return NextResponse.json({ error: 'Instance not authorized' }, { status: 403 });
    }

    const res = await fetch(`${config.evolution_api_url}/instance/qrcode/${instance}`, {
      headers: { 'apikey': decryptToken(config.evolution_api_key) },
    });

    if (!res.ok) {
      return NextResponse.json({ qrCode: null });
    }

    const data = await res.json();
    return NextResponse.json({ qrCode: data?.base64 ?? null });
  } catch (error) {
    logger.error('get-qrcode error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
