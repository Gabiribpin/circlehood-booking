import { timingSafeEqual } from 'crypto';

/**
 * Verify cron secret using timing-safe comparison to prevent timing attacks.
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const expected = `Bearer ${cronSecret}`;
  if (!authHeader || authHeader.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}
