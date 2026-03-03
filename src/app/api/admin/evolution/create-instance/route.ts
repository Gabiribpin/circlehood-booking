import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { evolutionConfig } from '@/lib/evolution/config';

const SALES_INSTANCE = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';
const SYSTEM_USER_ID = '00000000-0000-4000-a000-000000000000';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get('admin_session')?.value !== '1') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone, method = 'qrcode' } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const instanceName = SALES_INSTANCE;
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/sales-bot/webhook`;

    // ── 1. Create instance (or get existing) ──────────────────────────────
    const createRes = await fetch(`${evolutionConfig.baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': evolutionConfig.globalApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceName,
        number: normalizedPhone,
        qrcode: method !== 'pairing',
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT'],
        },
      }),
    });

    const createData = await createRes.json();

    let instanceToken: string;
    let qrCode: string | null = null;
    let pairingCode: string | null = null;

    if (!createRes.ok) {
      // Instance already exists — fetch token
      const fetchRes = await fetch(`${evolutionConfig.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
        headers: { 'apikey': evolutionConfig.globalApiKey },
      });
      const fetchData = await fetchRes.json();
      const existing = Array.isArray(fetchData) ? fetchData[0] : fetchData;

      if (!existing?.token) {
        return NextResponse.json({ error: 'Falha ao obter token da instância.' }, { status: 502 });
      }
      instanceToken = existing.token;

      if (method === 'pairing') {
        const pairRes = await fetch(
          `${evolutionConfig.baseUrl}/instance/connect/${instanceName}?number=${normalizedPhone}`,
          { headers: { 'apikey': instanceToken } },
        );
        const pairData = await pairRes.json();
        logger.info('[admin/create-instance] pairing connect response:', JSON.stringify(pairData));
        pairingCode = pairData?.pairingCode ?? null;
      } else {
        const qrRes = await fetch(`${evolutionConfig.baseUrl}/instance/connect/${instanceName}`, {
          headers: { 'apikey': instanceToken },
        });
        const qrRaw = await qrRes.json();
        logger.info('[admin/create-instance] qr connect response:', JSON.stringify(qrRaw));
        qrCode = qrRaw?.base64 ?? qrRaw?.qrcode?.base64 ?? qrRaw?.code ?? null;
      }
    } else {
      logger.info('[admin/create-instance] createData:', JSON.stringify(createData));
      instanceToken = createData?.hash?.apikey ?? createData?.instance?.token ?? '';

      if (!instanceToken) {
        const fetchRes2 = await fetch(`${evolutionConfig.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
          headers: { 'apikey': evolutionConfig.globalApiKey },
        });
        const fetchData2 = await fetchRes2.json();
        const inst = Array.isArray(fetchData2) ? fetchData2[0] : fetchData2;
        instanceToken = inst?.token ?? '';
        logger.info('[admin/create-instance] fallback token fetch:', instanceToken ? 'OK' : 'EMPTY');
      }

      if (method === 'pairing') {
        const pairRes = await fetch(
          `${evolutionConfig.baseUrl}/instance/connect/${instanceName}?number=${normalizedPhone}`,
          { headers: { 'apikey': instanceToken || evolutionConfig.globalApiKey } },
        );
        const pairData = await pairRes.json();
        logger.info('[admin/create-instance] pairing response:', JSON.stringify(pairData));
        pairingCode = pairData?.pairingCode ?? null;
      } else {
        qrCode = createData?.qrcode?.base64 ?? null;
      }
    }

    // ── 2. Set webhook ────────────────────────────────────────────────────
    await fetch(`${evolutionConfig.baseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': evolutionConfig.globalApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: ['MESSAGES_UPSERT'],
      }),
    });

    // ── 3. Save to Supabase (service role — bypasses RLS) ───────────────
    const supabase = createAdminClient();
    await supabase
      .from('whatsapp_config')
      .upsert({
        user_id: SYSTEM_USER_ID,
        provider: 'evolution',
        evolution_api_url: evolutionConfig.baseUrl,
        evolution_api_key: instanceToken,
        evolution_instance: instanceName,
        business_phone: normalizedPhone,
        is_active: false,
        updated_at: new Date().toISOString(),
      } as never, { onConflict: 'user_id' });

    return NextResponse.json({ instanceName, qrCode, pairingCode, token: instanceToken });
  } catch (error) {
    logger.error('admin/create-instance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
