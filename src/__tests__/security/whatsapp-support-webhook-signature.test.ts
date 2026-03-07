import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #184: /api/webhooks/whatsapp-support without signature validation
 *
 * The webhook accepted any payload without verifying the apikey header,
 * allowing attackers to inject fake tickets, send WhatsApp messages,
 * and consume Anthropic API credits.
 */

const routePath = resolve('src/app/api/webhooks/whatsapp-support/route.ts');
const source = readFileSync(routePath, 'utf-8');

describe('whatsapp-support webhook signature validation (issue #184)', () => {
  it('imports validateEvolutionWebhook', () => {
    expect(source).toContain("import { validateEvolutionWebhook } from '@/lib/webhooks/signature'");
  });

  it('reads apikey header from request', () => {
    expect(source).toContain("request.headers.get('apikey')");
  });

  it('validates apikey against WHATSAPP_WEBHOOK_SECRET', () => {
    expect(source).toContain('WHATSAPP_WEBHOOK_SECRET');
    expect(source).toContain('validateEvolutionWebhook(apikeyHeader, process.env.WHATSAPP_WEBHOOK_SECRET)');
  });

  it('returns 401 when signature is invalid', () => {
    expect(source).toContain("status: 401");
    // The 401 should come BEFORE any JSON parsing or business logic
    const signatureCheckPos = source.indexOf('validateEvolutionWebhook');
    const jsonParsePos = source.indexOf('request.json()');
    expect(signatureCheckPos).toBeLessThan(jsonParsePos);
  });

  it('validates signature before processing any message data', () => {
    // Search within the POST handler body only (after "export async function POST")
    const postBody = source.slice(source.indexOf('export async function POST'));
    const signatureCheckPos = postBody.indexOf('validateEvolutionWebhook');
    const adminClientPos = postBody.indexOf('createAdminClient()');
    const aiHandlerPos = postBody.indexOf('handleWhatsAppSupportMessage(');
    const sendReplyPos = postBody.indexOf('sendWhatsAppReply(remoteJid');

    // Signature check must come before ALL business logic
    expect(signatureCheckPos).toBeLessThan(adminClientPos);
    expect(signatureCheckPos).toBeLessThan(aiHandlerPos);
    expect(signatureCheckPos).toBeLessThan(sendReplyPos);
  });

  it('uses the same validation pattern as sales-bot webhook', () => {
    const salesBotSource = readFileSync(
      resolve('src/app/api/sales-bot/webhook/route.ts'),
      'utf-8'
    );
    // Both should use validateEvolutionWebhook
    expect(salesBotSource).toContain('validateEvolutionWebhook');
    expect(source).toContain('validateEvolutionWebhook');
  });
});

describe('validateEvolutionWebhook implementation', () => {
  it('uses timing-safe comparison', () => {
    const sigSource = readFileSync(
      resolve('src/lib/webhooks/signature.ts'),
      'utf-8'
    );
    expect(sigSource).toContain('timingSafeEqual');
  });

  it('skips validation when secret is not configured', () => {
    const sigSource = readFileSync(
      resolve('src/lib/webhooks/signature.ts'),
      'utf-8'
    );
    expect(sigSource).toContain('if (!secret) return true');
  });

  it('rejects when apikey header is missing', () => {
    const sigSource = readFileSync(
      resolve('src/lib/webhooks/signature.ts'),
      'utf-8'
    );
    expect(sigSource).toContain('if (!apikeyHeader) return false');
  });
});
