import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptToken, isEncrypted } from '@/lib/integrations/token-encryption';

// One-time endpoint to encrypt existing plaintext OAuth tokens in the DB.
// Protected: only runs if SETUP_SECRET matches.
// Call: POST /api/admin/encrypt-existing-tokens  { "secret": "<SETUP_SECRET>" }

export async function POST(request: Request) {
  const { secret } = await request.json();

  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let encrypted = 0;
  let skipped = 0;
  let errors = 0;

  // 1. Encrypt Instagram access_token (stored as top-level column)
  const { data: instagramRows } = await supabase
    .from('integrations')
    .select('id, access_token')
    .eq('type', 'instagram')
    .not('access_token', 'is', null);

  for (const row of instagramRows ?? []) {
    if (!row.access_token || isEncrypted(row.access_token)) {
      skipped++;
      continue;
    }
    try {
      await supabase
        .from('integrations')
        .update({ access_token: encryptToken(row.access_token) })
        .eq('id', row.id);
      encrypted++;
    } catch {
      errors++;
    }
  }

  // 2. Encrypt Google Calendar credentials JSONB (access_token + refresh_token)
  const { data: googleRows } = await supabase
    .from('integrations')
    .select('id, credentials')
    .eq('integration_type', 'google_calendar')
    .not('credentials', 'is', null);

  for (const row of googleRows ?? []) {
    const creds = row.credentials as Record<string, unknown> | null;
    if (!creds?.access_token || !creds?.refresh_token) {
      skipped++;
      continue;
    }
    if (
      isEncrypted(creds.access_token as string) &&
      isEncrypted(creds.refresh_token as string)
    ) {
      skipped++;
      continue;
    }
    try {
      await supabase
        .from('integrations')
        .update({
          credentials: {
            ...creds,
            access_token: isEncrypted(creds.access_token as string)
              ? creds.access_token
              : encryptToken(creds.access_token as string),
            refresh_token: isEncrypted(creds.refresh_token as string)
              ? creds.refresh_token
              : encryptToken(creds.refresh_token as string),
          },
        })
        .eq('id', row.id);
      encrypted++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    success: true,
    encrypted,
    skipped,
    errors,
  });
}
