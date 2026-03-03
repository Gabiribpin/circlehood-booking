/**
 * Production-safe logger.
 *
 * - `logger.info()` / `logger.log()` → suppressed in production (prevents sensitive data leakage)
 * - `logger.error()` → always logs (needed for debugging in Vercel logs)
 * - `logger.warn()` → always logs (needed for operational awareness)
 */

const isProduction = process.env.NODE_ENV === 'production';

function noop(..._args: unknown[]) {
  // intentionally empty — suppresses logs in production
}

export const logger = {
  /** Debug/info logging — suppressed in production */
  log: isProduction ? noop : console.log.bind(console),
  /** Alias for log — suppressed in production */
  info: isProduction ? noop : console.log.bind(console),
  /** Warnings — always logged */
  warn: console.warn.bind(console),
  /** Errors — always logged */
  error: console.error.bind(console),
};
