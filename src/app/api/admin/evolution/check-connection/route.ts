import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAdminToken } from '@/lib/admin/session';
import { decryptToken } from '@/lib/integrations/token-encryption';

const SALES_INSTANCE = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';

export async function GET() {
  try {
    const cookieStore = await cookies();
    if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('evolution_api_url, evolution_api_key, is_active')
      .eq('evolution_instance', SALES_INSTANCE)
      .single();

    if (!config?.evolution_api_key) {
      return NextResponse.json({ connected: false, state: 'no_config' });
    }

    const res = await fetch(`${config.evolution_api_url}/instance/connectionState/${SALES_INSTANCE}`, {
      headers: { 'apikey': decryptToken(config.evolution_api_key) },
    });

    if (!res.ok) {
      return NextResponse.json({ connected: false, state: 'error' });
    }

    const data = await res.json();
    const connected = data?.instance?.state === 'open';

    if (connected && !config.is_active) {
      await supabase
        .from('whatsapp_config')
        .update({ is_active: true, updated_at: new Date().toISOString() } as never)
        .eq('evolution_instance', SALES_INSTANCE);
    }

    return NextResponse.json({ connected, state: data?.instance?.state ?? 'unknown' });
  } catch (error) {
    logger.error('admin/check-connection error:', error);
    return NextResponse.json({ connected: false, state: 'error' });
  }
}
