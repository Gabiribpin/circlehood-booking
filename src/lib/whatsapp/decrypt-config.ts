import { decryptToken } from '@/lib/integrations/token-encryption';

/**
 * Decrypt sensitive fields from whatsapp_config row.
 * Works with both encrypted (enc:...) and legacy plaintext values.
 */
export function decryptWhatsappConfig<T extends Record<string, unknown>>(config: T): T {
  const result = { ...config };

  const sensitiveFields = ['evolution_api_key', 'access_token', 'verify_token'] as const;

  for (const field of sensitiveFields) {
    if (field in result && typeof result[field] === 'string' && result[field]) {
      (result as Record<string, unknown>)[field] = decryptToken(result[field] as string);
    }
  }

  return result;
}
