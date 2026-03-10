import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import {
  getCurrentKeyVersion,
  reEncryptToken,
  isEncrypted,
} from '@/lib/integrations/token-encryption';

/**
 * POST /api/admin/rotate-encryption-key
 *
 * Re-encrypts all PII fields (professionals + integrations + whatsapp_config)
 * from their current key version to the active ENCRYPTION_KEY_VERSION.
 *
 * Steps to rotate:
 * 1. Generate new 32-byte key, set as OAUTH_TOKEN_ENCRYPTION_KEY_V<N>
 * 2. Set ENCRYPTION_KEY_VERSION=<N>
 * 3. Keep old key(s) in env (OAUTH_TOKEN_ENCRYPTION_KEY for v1, _V2 for v2, etc.)
 * 4. Call this endpoint to re-encrypt all data
 * 5. After confirming success, old keys can be removed
 *
 * Body: { "secret": "<SETUP_SECRET>" }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { secret } = body;
  const expected = process.env.SETUP_SECRET ?? '';
  if (
    !secret ||
    !expected ||
    typeof secret !== 'string' ||
    secret.length !== expected.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetVersion = getCurrentKeyVersion();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const stats = { rotated: 0, skipped: 0, errors: 0 };

  // ─── 1. Professionals PII fields ────────────────────────────────────────
  const piiFields = [
    'payment_full_name',
    'payment_dob',
    'payment_iban',
    'payment_address_line1',
    'payment_address_line2',
  ] as const;

  const { data: professionals } = await supabase
    .from('professionals')
    .select('id, encryption_key_version, payment_full_name, payment_dob, payment_iban, payment_address_line1, payment_address_line2')
    .neq('encryption_key_version', targetVersion);

  for (const prof of (professionals ?? []) as Record<string, unknown>[]) {
    const updates: Record<string, unknown> = {};
    let hasUpdates = false;

    for (const field of piiFields) {
      const value = prof[field] as string | null;
      if (!value || !isEncrypted(value)) continue;

      const reEncrypted = reEncryptToken(value);
      if (reEncrypted) {
        updates[field] = reEncrypted;
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      updates.encryption_key_version = targetVersion;
      const { error } = await supabase
        .from('professionals')
        .update(updates as never)
        .eq('id', prof.id as string);

      if (error) {
        logger.error('[rotate-encryption-key] professional update failed', { id: prof.id, error });
        stats.errors++;
      } else {
        stats.rotated++;
      }
    } else {
      // No encrypted PII fields but version mismatch — just bump version
      await supabase
        .from('professionals')
        .update({ encryption_key_version: targetVersion } as never)
        .eq('id', prof.id as string);
      stats.skipped++;
    }
  }

  // ─── 2. WhatsApp config tokens ──────────────────────────────────────────
  const { data: waConfigs } = await supabase
    .from('whatsapp_config')
    .select('id, evolution_api_key, access_token, verify_token');

  for (const config of waConfigs ?? []) {
    const updates: Record<string, unknown> = {};
    let hasUpdates = false;

    for (const field of ['evolution_api_key', 'access_token', 'verify_token'] as const) {
      const value = config[field] as string | null;
      if (!value || !isEncrypted(value)) continue;

      const reEncrypted = reEncryptToken(value);
      if (reEncrypted) {
        updates[field] = reEncrypted;
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      const { error } = await supabase
        .from('whatsapp_config')
        .update(updates)
        .eq('id', config.id);

      if (error) {
        logger.error('[rotate-encryption-key] whatsapp_config update failed', { id: config.id, error });
        stats.errors++;
      } else {
        stats.rotated++;
      }
    } else {
      stats.skipped++;
    }
  }

  // ─── 3. Integration tokens (Instagram, Google Calendar) ─────────────────
  const { data: integrations } = await supabase
    .from('integrations')
    .select('id, type, integration_type, access_token, credentials');

  for (const integration of integrations ?? []) {
    const updates: Record<string, unknown> = {};
    let hasUpdates = false;

    // Instagram: access_token column
    if (integration.access_token && isEncrypted(integration.access_token)) {
      const reEncrypted = reEncryptToken(integration.access_token);
      if (reEncrypted) {
        updates.access_token = reEncrypted;
        hasUpdates = true;
      }
    }

    // Google Calendar: credentials JSONB with access_token + refresh_token
    if (integration.credentials && typeof integration.credentials === 'object') {
      const creds = integration.credentials as Record<string, unknown>;
      const newCreds = { ...creds };
      let credsChanged = false;

      for (const field of ['access_token', 'refresh_token'] as const) {
        const val = creds[field] as string | undefined;
        if (val && isEncrypted(val)) {
          const reEncrypted = reEncryptToken(val);
          if (reEncrypted) {
            newCreds[field] = reEncrypted;
            credsChanged = true;
          }
        }
      }

      if (credsChanged) {
        updates.credentials = newCreds;
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      const { error } = await supabase
        .from('integrations')
        .update(updates)
        .eq('id', integration.id);

      if (error) {
        logger.error('[rotate-encryption-key] integration update failed', { id: integration.id, error });
        stats.errors++;
      } else {
        stats.rotated++;
      }
    } else {
      stats.skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    target_version: targetVersion,
    ...stats,
  });
}
