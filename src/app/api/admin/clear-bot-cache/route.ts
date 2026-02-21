import { NextRequest, NextResponse } from 'next/server';
import { clearMemoryCache } from '@/lib/ai/chatbot';
import { ConversationCache } from '@/lib/redis/conversation-cache';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { business_id, phone } = await req.json();
  if (!business_id || !phone) {
    return NextResponse.json({ error: 'business_id and phone required' }, { status: 400 });
  }

  const cacheKey = `${business_id}_${phone}`;

  // Limpar Redis (Tier 1)
  await ConversationCache.clear(cacheKey);

  // Limpar in-memory (Tier 3)
  const cleared = clearMemoryCache(cacheKey);

  return NextResponse.json({ ok: true, cacheKey, memoryCleared: cleared });
}
