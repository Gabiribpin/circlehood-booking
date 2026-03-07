import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Validates Evolution API webhook requests.
 * Checks that the `apikey` header matches the expected secret.
 */
export function validateEvolutionWebhook(
  apikeyHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return true; // secret not configured → skip validation (log warning at call site)
  if (!apikeyHeader) return false;

  // Timing-safe comparison
  try {
    const a = Buffer.from(apikeyHeader);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Validates Resend webhook requests using Svix signature verification.
 *
 * Resend uses Svix for webhook delivery. Headers:
 * - `svix-id`: unique message ID
 * - `svix-timestamp`: Unix timestamp (seconds)
 * - `svix-signature`: comma-separated signatures (format: `v1,<base64>`)
 *
 * @param rawBody - The raw request body as string
 * @param headers - Object with svix-id, svix-timestamp, svix-signature
 * @param secret - The webhook signing secret (starts with `whsec_`)
 * @param toleranceSeconds - Max age of timestamp (default 5 minutes)
 */
export function validateResendWebhook(
  rawBody: string,
  headers: {
    'svix-id': string | null;
    'svix-timestamp': string | null;
    'svix-signature': string | null;
  },
  secret: string | undefined,
  toleranceSeconds = 300
): boolean {
  if (!secret) return false;

  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignature = headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Check timestamp tolerance (prevent replay attacks)
  const ts = parseInt(svixTimestamp, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return false;

  // Decode secret (strip `whsec_` prefix, base64 decode)
  let secretBytes: Buffer;
  try {
    const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    secretBytes = Buffer.from(rawSecret, 'base64');
  } catch {
    return false;
  }

  // Build signed content
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

  // Compute expected signature
  const expectedSignature = createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // Parse received signatures (format: "v1,<base64> v1,<base64>")
  const receivedSignatures = svixSignature.split(' ');

  // Check if any signature matches
  for (const sig of receivedSignatures) {
    const parts = sig.split(',');
    if (parts.length !== 2 || parts[0] !== 'v1') continue;

    const receivedBase64 = parts[1];
    try {
      const a = Buffer.from(expectedSignature);
      const b = Buffer.from(receivedBase64);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}
