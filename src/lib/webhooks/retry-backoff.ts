/**
 * Exponential backoff delays for webhook retries.
 * Attempt 1: 1 min, Attempt 2: 5 min, Attempt 3: 30 min, Attempt 4: 2h, Attempt 5: 12h
 */
const BACKOFF_DELAYS_MS = [
  1 * 60 * 1000,       // 1 minute
  5 * 60 * 1000,       // 5 minutes
  30 * 60 * 1000,      // 30 minutes
  2 * 60 * 60 * 1000,  // 2 hours
  12 * 60 * 60 * 1000, // 12 hours
];

const MAX_ATTEMPTS = 5;

/**
 * Returns the delay in milliseconds for the given attempt number (0-indexed).
 * Returns null if max attempts exceeded.
 */
export function getRetryDelay(attempt: number): number | null {
  if (attempt < 0 || attempt >= MAX_ATTEMPTS) return null;
  return BACKOFF_DELAYS_MS[attempt] ?? null;
}

/**
 * Calculates the next retry timestamp based on the current attempt count.
 * Returns null if max attempts reached (should become dead_letter).
 */
export function getNextRetryAt(attemptCount: number): Date | null {
  const delay = getRetryDelay(attemptCount);
  if (delay === null) return null;
  return new Date(Date.now() + delay);
}

/**
 * Whether the failure has exhausted all retry attempts.
 */
export function isDeadLetter(attemptCount: number): boolean {
  return attemptCount >= MAX_ATTEMPTS;
}

export { MAX_ATTEMPTS, BACKOFF_DELAYS_MS };
