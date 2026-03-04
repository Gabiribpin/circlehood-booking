import { logger } from '@/lib/logger';
import { getNextRetryAt, isDeadLetter } from './retry-backoff';
import type { SupabaseClient } from '@supabase/supabase-js';

interface RecordFailureParams {
  supabase: SupabaseClient;
  webhookType: string;
  eventType?: string;
  payload: Record<string, unknown>;
  error: string;
}

/**
 * Records a webhook failure and schedules the first retry.
 */
export async function recordWebhookFailure({
  supabase,
  webhookType,
  eventType,
  payload,
  error,
}: RecordFailureParams) {
  const nextRetry = getNextRetryAt(0);

  const { error: insertError } = await supabase.from('webhook_failures').insert({
    webhook_type: webhookType,
    event_type: eventType ?? null,
    payload,
    error,
    status: 'pending',
    attempt_count: 0,
    next_retry_at: nextRetry?.toISOString() ?? null,
  } as never);

  if (insertError) {
    logger.error('[webhook-retry-queue] Failed to record failure:', insertError);
  }
}

/**
 * Processes pending webhook retries. Called by the cron job.
 * Returns the number of items processed and results.
 */
export async function processWebhookRetries(supabase: SupabaseClient) {
  const now = new Date().toISOString();

  // Fetch retryable failures: pending/retrying with next_retry_at <= now
  const { data: failures, error: fetchError } = await supabase
    .from('webhook_failures')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .lte('next_retry_at', now)
    .order('next_retry_at', { ascending: true })
    .limit(50);

  if (fetchError) {
    logger.error('[webhook-retry-queue] Failed to fetch retries:', fetchError);
    return { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 };
  }

  if (!failures || failures.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const failure of failures) {
    const newAttemptCount = failure.attempt_count + 1;

    try {
      // Attempt to replay the webhook
      const result = await replayWebhook(failure.webhook_type, failure.payload);

      if (result.success) {
        // Mark as resolved
        await supabase
          .from('webhook_failures')
          .update({
            status: 'resolved',
            attempt_count: newAttemptCount,
            last_attempted_at: now,
            resolved_at: now,
            updated_at: now,
          } as never)
          .eq('id', failure.id);
        succeeded++;
      } else {
        throw new Error(result.error || 'Replay failed');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';

      if (isDeadLetter(newAttemptCount)) {
        // Max attempts reached — dead letter
        await supabase
          .from('webhook_failures')
          .update({
            status: 'dead_letter',
            attempt_count: newAttemptCount,
            last_attempted_at: now,
            error: errorMsg,
            updated_at: now,
          } as never)
          .eq('id', failure.id);
        deadLettered++;
      } else {
        // Schedule next retry
        const nextRetry = getNextRetryAt(newAttemptCount);
        await supabase
          .from('webhook_failures')
          .update({
            status: 'retrying',
            attempt_count: newAttemptCount,
            last_attempted_at: now,
            next_retry_at: nextRetry?.toISOString() ?? null,
            error: errorMsg,
            updated_at: now,
          } as never)
          .eq('id', failure.id);
        failed++;
      }
    }
  }

  return { processed: failures.length, succeeded, failed, deadLettered };
}

/**
 * Replays a webhook by re-invoking the appropriate internal handler.
 * This is a simplified approach: POST the payload to the original webhook route.
 */
async function replayWebhook(
  webhookType: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const routeMap: Record<string, string> = {
    stripe: '/api/stripe/webhook',
    stripe_deposit: '/api/webhooks/stripe-deposit',
    stripe_connect: '/api/webhooks/stripe-connect',
    evolution_api: '/api/whatsapp/webhook',
    resend: '/api/webhooks/resend',
    revolut: '/api/webhooks/revolut',
  };

  const route = routeMap[webhookType];
  if (!route) {
    return { success: false, error: `Unknown webhook type: ${webhookType}` };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-retry': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 200) {
      return { success: true };
    }

    const text = await res.text().catch(() => '');
    return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
