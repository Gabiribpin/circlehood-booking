import { logger } from '@/lib/logger';
/**
 * Wrapper resiliente para envio de email.
 * Retry 2x com backoff exponencial + timeout de 30s por tentativa.
 * Nunca lança exceção — retorna { success, error } sempre.
 */

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: operação excedeu ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

export async function safeSendEmail(
  fn: () => Promise<void>,
  options: {
    retries?: number;
    timeoutMs?: number;
    label?: string;
    onFailure?: (error: string, attempt: number) => void;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const { retries = 2, timeoutMs = 30_000, label = 'Email', onFailure } = options;
  let lastError = '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await withTimeout(fn(), timeoutMs);
      if (attempt > 0) {
        logger.info(`[SafeSend] ${label} OK na tentativa ${attempt + 1}`);
      }
      return { success: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.error(`[SafeSend] ${label} tentativa ${attempt + 1}/${retries + 1} falhou:`, lastError);
      onFailure?.(lastError, attempt + 1);

      if (attempt < retries) {
        // Backoff exponencial: 500ms → 1000ms
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }

  return { success: false, error: lastError };
}
