import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests that SQL wildcard characters are escaped before ilike queries
 * in chatbot.ts to prevent wildcard injection attacks.
 *
 * Attack vector: user says "quero agendar um %" → bot calls
 * createAppointment({ service_name: "%" }) → ilike('name', '%%%')
 * matches ALL services → books wrong service.
 */

describe('ilike wildcard injection prevention', () => {
  const chatbotSource = fs.readFileSync(
    path.resolve('src/lib/ai/chatbot.ts'),
    'utf-8'
  );

  it('escapes % and _ wildcards before ilike query', () => {
    // The fix: data.service_name.replace(/[%_\\]/g, '\\$&')
    expect(chatbotSource).toContain("replace(/[%_\\\\]/g, '\\\\$&')");
  });

  it('uses escaped variable (safeName) in ilike, not raw service_name', () => {
    // Should use safeName in the ilike, not data.service_name
    expect(chatbotSource).toContain('.ilike(\'name\', `%${safeName}%`)');
    expect(chatbotSource).not.toContain('.ilike(\'name\', `%${data.service_name}%`)');
  });

  it('escape function correctly sanitizes wildcards', () => {
    // Replicate the same escape logic used in chatbot.ts
    const escape = (s: string) => s.replace(/[%_\\]/g, '\\$&');

    // "%" → "\%" (literal percent, no wildcard)
    expect(escape('%')).toBe('\\%');

    // "_" → "\_" (literal underscore, no single-char wildcard)
    expect(escape('_')).toBe('\\_');

    // "\\" → "\\\\" (escape the escape char)
    expect(escape('\\')).toBe('\\\\');

    // Normal service names pass through unchanged
    expect(escape('Corte')).toBe('Corte');
    expect(escape('Corte e Barba')).toBe('Corte e Barba');

    // Mixed input
    expect(escape('50% off_special')).toBe('50\\% off\\_special');
  });
});
