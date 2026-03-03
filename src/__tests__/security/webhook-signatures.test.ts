import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #20: Webhook signature validation
 *
 * Fixes:
 * 1. sales-bot webhook validates Evolution API `apikey` header
 * 2. Resend webhook validates Svix signatures (HMAC-SHA256 + timestamp tolerance)
 */

// ─── Evolution API webhook validation ────────────────────────────────────────

describe('validateEvolutionWebhook (issue #20)', () => {
  it('returns true when apikey header matches secret', async () => {
    const { validateEvolutionWebhook } = await import('@/lib/webhooks/signature');
    expect(validateEvolutionWebhook('my-secret-key', 'my-secret-key')).toBe(true);
  });

  it('returns false when apikey header does not match', async () => {
    const { validateEvolutionWebhook } = await import('@/lib/webhooks/signature');
    expect(validateEvolutionWebhook('wrong-key', 'my-secret-key')).toBe(false);
  });

  it('returns false when apikey header is null', async () => {
    const { validateEvolutionWebhook } = await import('@/lib/webhooks/signature');
    expect(validateEvolutionWebhook(null, 'my-secret-key')).toBe(false);
  });

  it('returns false when secret is undefined', async () => {
    const { validateEvolutionWebhook } = await import('@/lib/webhooks/signature');
    expect(validateEvolutionWebhook('some-key', undefined)).toBe(false);
  });

  it('returns false when both are empty strings', async () => {
    const { validateEvolutionWebhook } = await import('@/lib/webhooks/signature');
    expect(validateEvolutionWebhook('', '')).toBe(false);
  });

  it('is case-sensitive', async () => {
    const { validateEvolutionWebhook } = await import('@/lib/webhooks/signature');
    expect(validateEvolutionWebhook('MySecret', 'mysecret')).toBe(false);
  });
});

// ─── Resend / Svix webhook validation ────────────────────────────────────────

describe('validateResendWebhook (issue #20)', () => {
  const secret = 'whsec_' + Buffer.from('test-secret-key-32bytes!!').toString('base64');

  function signPayload(svixId: string, timestamp: string, body: string) {
    const rawSecret = secret.slice(6);
    const secretBytes = Buffer.from(rawSecret, 'base64');
    const signedContent = `${svixId}.${timestamp}.${body}`;
    const sig = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    return `v1,${sig}`;
  }

  it('returns true for valid signature', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    const body = '{"type":"email.delivered"}';
    const svixId = 'msg_abc123';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(svixId, timestamp, body);

    expect(validateResendWebhook(body, {
      'svix-id': svixId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    }, secret)).toBe(true);
  });

  it('returns true when valid signature is among multiple', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    const body = '{"type":"email.opened"}';
    const svixId = 'msg_multi';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const validSig = signPayload(svixId, timestamp, body);
    const signatures = `v1,invalidbase64garbage ${validSig}`;

    expect(validateResendWebhook(body, {
      'svix-id': svixId,
      'svix-timestamp': timestamp,
      'svix-signature': signatures,
    }, secret)).toBe(true);
  });

  it('returns false for wrong signature', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    const body = '{"type":"email.delivered"}';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    expect(validateResendWebhook(body, {
      'svix-id': 'msg_wrong',
      'svix-timestamp': timestamp,
      'svix-signature': 'v1,dGhpc2lzaW52YWxpZA==',
    }, secret)).toBe(false);
  });

  it('returns false when secret is undefined', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    expect(validateResendWebhook('{}', {
      'svix-id': 'msg_1',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,abc',
    }, undefined)).toBe(false);
  });

  it('returns false when svix-id is missing', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    expect(validateResendWebhook('{}', {
      'svix-id': null,
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,abc',
    }, secret)).toBe(false);
  });

  it('returns false when svix-timestamp is missing', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    expect(validateResendWebhook('{}', {
      'svix-id': 'msg_1',
      'svix-timestamp': null,
      'svix-signature': 'v1,abc',
    }, secret)).toBe(false);
  });

  it('returns false when svix-signature is missing', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    expect(validateResendWebhook('{}', {
      'svix-id': 'msg_1',
      'svix-timestamp': '1234567890',
      'svix-signature': null,
    }, secret)).toBe(false);
  });

  it('returns false when timestamp is too old (replay attack)', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    const body = '{"type":"email.delivered"}';
    const svixId = 'msg_old';
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 min ago
    const signature = signPayload(svixId, oldTimestamp, body);

    expect(validateResendWebhook(body, {
      'svix-id': svixId,
      'svix-timestamp': oldTimestamp,
      'svix-signature': signature,
    }, secret)).toBe(false);
  });

  it('returns false when timestamp is in the future', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    const body = '{"type":"email.delivered"}';
    const svixId = 'msg_future';
    const futureTimestamp = (Math.floor(Date.now() / 1000) + 600).toString();
    const signature = signPayload(svixId, futureTimestamp, body);

    expect(validateResendWebhook(body, {
      'svix-id': svixId,
      'svix-timestamp': futureTimestamp,
      'svix-signature': signature,
    }, secret)).toBe(false);
  });

  it('returns false when timestamp is not a number', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    expect(validateResendWebhook('{}', {
      'svix-id': 'msg_1',
      'svix-timestamp': 'not-a-number',
      'svix-signature': 'v1,abc',
    }, secret)).toBe(false);
  });

  it('returns false when body was tampered with', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    const originalBody = '{"type":"email.delivered"}';
    const svixId = 'msg_tamper';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(svixId, timestamp, originalBody);

    // Tamper with the body
    expect(validateResendWebhook('{"type":"email.bounced"}', {
      'svix-id': svixId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    }, secret)).toBe(false);
  });

  it('handles secret without whsec_ prefix', async () => {
    const { validateResendWebhook } = await import('@/lib/webhooks/signature');
    const rawSecret = Buffer.from('test-secret-key-32bytes!!').toString('base64');
    const body = '{"type":"email.delivered"}';
    const svixId = 'msg_noprefix';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const secretBytes = Buffer.from(rawSecret, 'base64');
    const signedContent = `${svixId}.${timestamp}.${body}`;
    const sig = createHmac('sha256', secretBytes).update(signedContent).digest('base64');

    expect(validateResendWebhook(body, {
      'svix-id': svixId,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${sig}`,
    }, rawSecret)).toBe(true);
  });
});

// ─── Code verification ───────────────────────────────────────────────────────

describe('Webhook route code verification (issue #20)', () => {
  it('sales-bot webhook validates apikey header', () => {
    const source = readFileSync(
      resolve('src/app/api/sales-bot/webhook/route.ts'),
      'utf-8'
    );
    expect(source).toContain('validateEvolutionWebhook');
    expect(source).toContain('SALES_WEBHOOK_SECRET');
    expect(source).toContain('401');
  });

  it('Resend webhook validates Svix signature', () => {
    const source = readFileSync(
      resolve('src/app/api/webhooks/resend/route.ts'),
      'utf-8'
    );
    expect(source).toContain('validateResendWebhook');
    expect(source).toContain('svix-id');
    expect(source).toContain('svix-timestamp');
    expect(source).toContain('svix-signature');
    expect(source).toContain('RESEND_WEBHOOK_SECRET');
    expect(source).toContain('401');
  });

  it('Resend webhook reads raw body (not parsed JSON) for signature verification', () => {
    const source = readFileSync(
      resolve('src/app/api/webhooks/resend/route.ts'),
      'utf-8'
    );
    expect(source).toContain('request.text()');
    expect(source).toContain('JSON.parse(rawBody)');
  });
});
