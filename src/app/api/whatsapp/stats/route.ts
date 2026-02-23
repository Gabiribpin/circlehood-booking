import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WhatsAppRateLimiter } from '@/lib/whatsapp/rate-limiter';

export async function GET() {
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

  const stats = WhatsAppRateLimiter.getStats(professional.id);

  return NextResponse.json(stats);
}
