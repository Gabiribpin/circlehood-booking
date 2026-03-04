import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #132: WhatsApp webhook missing signature validation
 *
 * The main WhatsApp webhook (/api/whatsapp/webhook) was accepting ANY POST
 * request without verifying the `apikey` header, allowing attackers to inject
 * fake messages and trigger bot responses.
 */

describe('WhatsApp webhook signature validation (issue #132)', () => {
  const source = readFileSync(
    resolve('src/app/api/whatsapp/webhook/route.ts'),
    'utf-8'
  );

  it('imports validateEvolutionWebhook', () => {
    expect(source).toContain('validateEvolutionWebhook');
  });

  it('reads apikey header from request', () => {
    expect(source).toContain("request.headers.get('apikey')");
  });

  it('uses WHATSAPP_WEBHOOK_SECRET env var', () => {
    expect(source).toContain('WHATSAPP_WEBHOOK_SECRET');
  });

  it('returns 401 for invalid/missing apikey', () => {
    expect(source).toContain('401');
    // Ensure the 401 is tied to the webhook validation, not some other check
    expect(source).toContain("{ error: 'Unauthorized' }");
  });

  it('validates signature BEFORE parsing request body', () => {
    const validateIndex = source.indexOf('validateEvolutionWebhook');
    const jsonParseIndex = source.indexOf('request.json()');
    expect(validateIndex).toBeGreaterThan(-1);
    expect(jsonParseIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeLessThan(jsonParseIndex);
  });

  it('logs a warning when validation fails', () => {
    expect(source).toContain('[whatsapp/webhook] Invalid or missing apikey header');
  });

  it('WHATSAPP_WEBHOOK_SECRET is documented in .env.example', () => {
    const envExample = readFileSync(resolve('.env.example'), 'utf-8');
    expect(envExample).toContain('WHATSAPP_WEBHOOK_SECRET');
  });

  it('follows the same pattern as sales-bot webhook', () => {
    const salesBotSource = readFileSync(
      resolve('src/app/api/sales-bot/webhook/route.ts'),
      'utf-8'
    );
    // Both use validateEvolutionWebhook
    expect(salesBotSource).toContain('validateEvolutionWebhook');
    expect(source).toContain('validateEvolutionWebhook');

    // Both check apikey header
    expect(salesBotSource).toContain("request.headers.get('apikey')");
    expect(source).toContain("request.headers.get('apikey')");

    // Both return 401
    expect(salesBotSource).toContain('401');
    expect(source).toContain('401');
  });
});
