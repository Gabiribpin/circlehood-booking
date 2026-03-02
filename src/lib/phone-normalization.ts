import { parsePhoneNumber, type CountryCode } from 'libphonenumber-js';

/**
 * Normalizes a phone number to E.164 format (+353851234567).
 *
 * Handles:
 * - Local formats: 0851234567 → +353851234567
 * - International with +: +353851234567 → +353851234567
 * - International without +: 353851234567 → +353851234567
 * - With spaces/dashes: +353 85 123 4567 → +353851234567
 * - WhatsApp JID format: 353851234567@s.whatsapp.net → +353851234567
 *
 * @param phone - Phone number in any format
 * @param defaultCountry - Default country code for local numbers (default: 'IE')
 * @returns E.164 formatted number, or cleaned digits if parsing fails
 */
export function normalizePhone(phone: string, defaultCountry: CountryCode = 'IE'): string {
  if (!phone) return '';

  // Strip WhatsApp JID suffix
  let cleaned = phone.split('@')[0];

  // Strip all whitespace, dashes, parentheses
  cleaned = cleaned.replace(/[\s\-\(\)]/g, '');

  try {
    // Try parsing as-is first
    const parsed = parsePhoneNumber(cleaned, defaultCountry);
    if (parsed && parsed.isValid()) {
      return parsed.number; // E.164: +353851234567
    }
  } catch {
    // libphonenumber-js couldn't parse it
  }

  // Fallback: try with + prefix if it starts with a country code
  if (!cleaned.startsWith('+') && cleaned.length > 9) {
    try {
      const parsed = parsePhoneNumber('+' + cleaned);
      if (parsed && parsed.isValid()) {
        return parsed.number;
      }
    } catch {
      // Still couldn't parse
    }
  }

  // Last resort: return digits only with + prefix
  const digits = cleaned.replace(/[^0-9]/g, '');
  return digits ? `+${digits}` : '';
}

/**
 * Generates all reasonable phone variants for database lookup.
 * Used when we need to find a contact by phone but don't know
 * which format was stored.
 *
 * @param phone - Phone number in any format
 * @returns Array of normalized variants for OR query
 */
export function phoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  const digits = normalized.replace(/[^0-9]/g, '');

  const variants = new Set<string>();
  variants.add(normalized);          // +353851234567
  variants.add(digits);              // 353851234567
  variants.add(`+${digits}`);        // +353851234567 (same as normalized)

  // If starts with country code, also add local format
  // E.g., +353851234567 → 0851234567
  if (digits.startsWith('353') && digits.length > 3) {
    variants.add('0' + digits.slice(3)); // 0851234567
  }

  return [...variants];
}
