import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEvolutionMessage } from '@/lib/whatsapp/evolution';
import { WhatsAppRateLimiter } from '@/lib/whatsapp/rate-limiter';
import { decryptToken } from '@/lib/integrations/token-encryption';
import { z } from 'zod';

const sendSchema = z.object({
  to: z.string().min(1).regex(/^\+?[0-9\s()-]{7,20}$/, 'Invalid phone format'),
  message: z.string().min(1).max(4096),
});

const MAX_BODY_SIZE = 1_048_576; // 1 MB

export async function POST(request: NextRequest) {
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  try {
    const body = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { to, message } = parsed.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    // Rate limit: 30/h · 50/d · 200/sem
    const limit = WhatsAppRateLimiter.check(professional.id);
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.reason }, { status: 429 });
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('evolution_api_url, evolution_api_key, evolution_instance, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!config?.evolution_api_url || !config?.evolution_api_key) {
      return NextResponse.json(
        { error: 'WhatsApp (Evolution API) não configurado' },
        { status: 404 }
      );
    }

    await sendEvolutionMessage(to, message, {
      apiUrl: config.evolution_api_url,
      apiKey: decryptToken(config.evolution_api_key),
      instance: config.evolution_instance || 'default',
    });

    // Só incrementa após envio bem-sucedido
    WhatsAppRateLimiter.increment(professional.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error sending WhatsApp message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
