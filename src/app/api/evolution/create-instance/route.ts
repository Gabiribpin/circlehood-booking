import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evolutionConfig } from '@/lib/evolution/config';
import { encryptToken } from '@/lib/integrations/token-encryption';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { phone, method = 'qrcode' } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const instanceName = `prof-${user.id.replace(/-/g, '').substring(0, 12)}`;
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/whatsapp/webhook`;

    // ── 1. Create instance (or get existing) ──────────────────────────────
    // When using pairing method, don't request qrcode to avoid session conflict
    const createRes = await fetch(`${evolutionConfig.baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': evolutionConfig.globalApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceName,
        number: normalizedPhone,
        qrcode: method !== 'pairing', // only generate QR for qrcode method
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

      // Connect — method determines whether we get QR or pairing code
      if (method === 'pairing') {
        const pairRes = await fetch(
          `${evolutionConfig.baseUrl}/instance/connect/${instanceName}?number=${normalizedPhone}`,
          { headers: { 'apikey': instanceToken } },
        );
        const pairData = await pairRes.json();
        logger.info('[create-instance] pairing connect response:', JSON.stringify(pairData));
        pairingCode = pairData?.pairingCode ?? null;
      } else {
        const qrRes = await fetch(`${evolutionConfig.baseUrl}/instance/connect/${instanceName}`, {
          headers: { 'apikey': instanceToken },
        });
        const qrRaw = await qrRes.json();
        logger.info('[create-instance] qr connect response:', JSON.stringify(qrRaw));
        qrCode = qrRaw?.base64 ?? qrRaw?.qrcode?.base64 ?? qrRaw?.code ?? null;
      }
    } else {
      logger.info('[create-instance] createData:', JSON.stringify(createData));
      instanceToken = createData?.hash?.apikey ?? createData?.instance?.token ?? '';

      // If token extraction failed, fetch it explicitly
      if (!instanceToken) {
        const fetchRes2 = await fetch(`${evolutionConfig.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
          headers: { 'apikey': evolutionConfig.globalApiKey },
        });
        const fetchData2 = await fetchRes2.json();
        const inst = Array.isArray(fetchData2) ? fetchData2[0] : fetchData2;
        instanceToken = inst?.token ?? '';
        logger.info('[create-instance] fallback token fetch:', instanceToken ? 'OK' : 'EMPTY');
      }

      if (method === 'pairing') {
        // Instance just created without QR — now connect with number to get pairing code
        const pairRes = await fetch(
          `${evolutionConfig.baseUrl}/instance/connect/${instanceName}?number=${normalizedPhone}`,
          { headers: { 'apikey': instanceToken || evolutionConfig.globalApiKey } },
        );
        const pairData = await pairRes.json();
        logger.info('[create-instance] pairing response:', JSON.stringify(pairData));
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

    // ── 3. Save to Supabase ───────────────────────────────────────────────
    await supabase
      .from('whatsapp_config')
      .upsert({
        user_id: user.id,
        provider: 'evolution',
        evolution_api_url: evolutionConfig.baseUrl,
        evolution_api_key: encryptToken(instanceToken),
        evolution_instance: instanceName,
        business_phone: normalizedPhone,
        is_active: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return NextResponse.json({ instanceName, qrCode, pairingCode });
  } catch (error) {
    logger.error('create-instance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
