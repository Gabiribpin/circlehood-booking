import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppClient } from '@/lib/whatsapp/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { to, message } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: config, error } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured for this user' },
        { status: 404 }
      );
    }

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
