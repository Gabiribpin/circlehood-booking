import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// One-time endpoint to create storage buckets in production.
// Protected: only runs if SETUP_SECRET matches.
// Call: POST /api/admin/setup-storage  { "secret": "<SETUP_SECRET>" }

export async function POST(request: Request) {
  try {
  const { secret } = await request.json();

  const expected = process.env.SETUP_SECRET ?? '';
  if (!secret || !expected || !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Record<string, string> = {};

  for (const bucket of ['avatars', 'covers']) {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    });
    if (error) {
      results[bucket] = error.message.includes('already exists') ? '✅ already exists' : `❌ ${error.message}`;
    } else {
      results[bucket] = '✅ created';
    }
  }

  // Also verify buckets are accessible
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketNames = buckets?.map(b => b.name) ?? [];
  results['buckets_in_db'] = bucketNames.join(', ') || '(none)';

  return NextResponse.json({ ok: true, results });
  } catch (err) {
    logger.error('[admin/setup-storage]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
