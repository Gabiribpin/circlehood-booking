import { createClient } from '@supabase/supabase-js';

/**
 * Validates Evolution API webhook requests using per-instance secrets.
 *
 * Architecture:
 * - Each whatsapp_config row has its own `webhook_secret` (UUID generated at creation)
 * - Webhook requests are validated by matching the header secret against the DB secret
 * - This is MORE SECURE than a global env var: if one secret leaks, only that instance is affected
 *
 * Flow:
 * 1. Extract auth header from request (apikey or x-webhook-secret)
 * 2. Look up the instance's webhook_secret in DB
 * 3. Compare header === DB secret
 *
 * Strict mode (production): REJECTS requests without auth header
 * Non-strict mode (dev): ALLOWS without auth (with warning log)
 */
export async function validateEvolutionWebhook(
  headers: Headers,
  instanceName: string
): Promise<boolean> {
  const isStrict =
    process.env.NODE_ENV === 'production' ||
    process.env.EVOLUTION_WEBHOOK_STRICT === 'true';

  // Extract auth header — Evolution may send as 'apikey' or 'x-webhook-secret'
  const headerSecret =
    headers.get('apikey') || headers.get('x-webhook-secret');

  if (!headerSecret) {
    if (isStrict) {
      if (process.env.NODE_ENV !== 'test') console.warn('[webhook-auth] STRICT: rejected — no auth header for instance:', instanceName);
      return false;
    }
    if (process.env.NODE_ENV !== 'test') console.warn('[webhook-auth] DEV: accepted without auth header (INSECURE)');
    return true;
  }

  // Validate against per-instance secret stored in DB
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('whatsapp_config')
    .select('webhook_secret')
    .eq('evolution_instance', instanceName)
    .single();

  if (!data) {
    if (process.env.NODE_ENV !== 'test') console.warn('[webhook-auth] rejected — instance not found:', instanceName);
    return false;
  }

  if (!data.webhook_secret) {
    // Instance exists but has no webhook_secret yet (pre-migration)
    // In strict mode, reject; in dev, allow with warning
    if (isStrict) {
      if (process.env.NODE_ENV !== 'test') console.warn('[webhook-auth] STRICT: rejected — instance has no webhook_secret:', instanceName);
      return false;
    }
    if (process.env.NODE_ENV !== 'test') console.warn('[webhook-auth] DEV: accepted — instance has no webhook_secret yet');
    return true;
  }

  return headerSecret === data.webhook_secret;
}
