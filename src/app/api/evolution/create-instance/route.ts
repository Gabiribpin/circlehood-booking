import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evolutionConfig } from '@/lib/evolution/config';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Gerar nome único baseado no user ID
    const instanceName = `prof-${user.id.replace(/-/g, '').substring(0, 12)}`;
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/whatsapp/webhook`;

    // 1. Criar instância com Global API Key
    const createRes = await fetch(`${evolutionConfig.baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': evolutionConfig.globalApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceName,
        number: normalizedPhone,
        qrcode: true,
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

    // Se já existe, buscar token e QR code da instância existente
    let instanceToken: string;
    let qrCode: string | null = null;

    if (!createRes.ok) {
      // Instância já existe — buscar token via fetchInstances
      const fetchRes = await fetch(`${evolutionConfig.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
        headers: { 'apikey': evolutionConfig.globalApiKey },
      });
      const fetchData = await fetchRes.json();
      const existing = Array.isArray(fetchData) ? fetchData[0] : fetchData;

      if (!existing?.token) {
        return NextResponse.json({ error: 'Falha ao obter token da instância.' }, { status: 502 });
      }
      instanceToken = existing.token;

      // Buscar QR code da instância existente
      const qrRes = await fetch(`${evolutionConfig.baseUrl}/instance/qrcode/${instanceName}`, {
        headers: { 'apikey': evolutionConfig.globalApiKey },
      });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        qrCode = qrData?.base64 ?? null;
      }
    } else {
      instanceToken = createData?.hash?.apikey ?? createData?.instance?.token ?? '';
      qrCode = createData?.qrcode?.base64 ?? null;
    }

    // 2. Configurar webhook (caso não tenha sido incluído no create)
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

    // 3. Salvar no Supabase — TOKEN da instância (não global key)
    await supabase
      .from('whatsapp_config')
      .upsert({
        user_id: user.id,
        provider: 'evolution',
        evolution_api_url: evolutionConfig.baseUrl,
        evolution_api_key: instanceToken,
        evolution_instance: instanceName,
        business_phone: phone,
        is_active: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return NextResponse.json({ instanceName, qrCode, token: instanceToken });
  } catch (error) {
    console.error('create-instance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
