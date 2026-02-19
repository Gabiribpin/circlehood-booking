import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const instance = request.nextUrl.searchParams.get('instance');
    if (!instance) {
      return NextResponse.json({ error: 'Instance name required' }, { status: 400 });
    }

    // Buscar token da instância no Supabase
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('evolution_api_url, evolution_api_key')
      .eq('user_id', user.id)
      .single();

    if (!config?.evolution_api_key) {
      return NextResponse.json({ connected: false });
    }

    const res = await fetch(`${config.evolution_api_url}/instance/connectionState/${instance}`, {
      headers: { 'apikey': config.evolution_api_key },
    });

    if (!res.ok) {
      return NextResponse.json({ connected: false });
    }

    const data = await res.json();
    const connected = data?.instance?.state === 'open';

    // Ativar bot quando conectar
    if (connected) {
      await supabase
        .from('whatsapp_config')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ connected, state: data?.instance?.state ?? 'unknown' });
  } catch (error) {
    console.error('check-connection error:', error);
    return NextResponse.json({ connected: false });
  }
}
