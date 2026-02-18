import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppClient } from '@/lib/whatsapp/client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { to, message, userId } = await request.json();

    if (!to || !message || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message, userId' },
        { status: 400 }
      );
    }

    // Buscar configuração do WhatsApp do usuário
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: config, error } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured for this user' },
        { status: 404 }
      );
    }

    // Enviar mensagem
    const whatsapp = new WhatsAppClient({
      phoneNumberId: config.phone_number_id,
      accessToken: config.access_token
    });

    const result = await whatsapp.sendMessage(to, message);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
