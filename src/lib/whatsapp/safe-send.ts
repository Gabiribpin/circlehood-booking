import { logger } from '@/lib/logger';
/**
 * Wrapper resiliente para envio de WhatsApp.
 * Retry 2x com backoff exponencial + timeout de 30s por tentativa.
 * Nunca lança exceção — retorna { success, error } sempre.
 */

import { withTimeout } from '@/lib/email/safe-send';

export async function safeSendWhatsApp(
  fn: () => Promise<void>,
  options: {
    retries?: number;
    timeoutMs?: number;
    onFailure?: (error: string, attempt: number) => void;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const { retries = 2, timeoutMs = 30_000, onFailure } = options;
  let lastError = '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await withTimeout(fn(), timeoutMs);
      if (attempt > 0) {
        logger.info(`[SafeSend] WhatsApp OK na tentativa ${attempt + 1}`);
      }
      return { success: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.error(`[SafeSend] WhatsApp tentativa ${attempt + 1}/${retries + 1} falhou:`, lastError);
      onFailure?.(lastError, attempt + 1);

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }

  return { success: false, error: lastError };
}
