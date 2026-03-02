/**
 * Masks sensitive values in HTTP headers for safe logging.
 * Shows first 8 characters + '***' for sensitive keys.
 */

const SENSITIVE_KEYS = ['secret', 'apikey', 'authorization', 'token', 'password'];

export function maskSensitiveHeaders(headers: Headers): Record<string, string> {
  const safe: Record<string, string> = {};

  headers.forEach((value, key) => {
    const isSensitive = SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k));

    if (isSensitive && value.length > 8) {
      safe[key] = `${value.substring(0, 8)}***`;
    } else if (isSensitive) {
      safe[key] = '***';
    } else {
      safe[key] = value;
    }
  });

  return safe;
}
