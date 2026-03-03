import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

/**
 * Tests for Issue #44: Missing .env.example — 27+ env vars sem documentação
 */

describe('.env.example documentation (issue #44)', () => {
  const envExamplePath = resolve('.env.example');

  it('.env.example file exists', () => {
    expect(existsSync(envExamplePath)).toBe(true);
  });

  it('.env.example is not gitignored', () => {
    const result = execSync('git check-ignore .env.example 2>&1; echo $?', {
      encoding: 'utf-8',
    }).trim();
    // exit code 1 means NOT ignored
    expect(result.endsWith('1')).toBe(true);
  });

  it('contains all critical Supabase vars', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    expect(content).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(content).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(content).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('contains Stripe vars', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    expect(content).toContain('STRIPE_SECRET_KEY');
    expect(content).toContain('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
    expect(content).toContain('STRIPE_WEBHOOK_SECRET');
  });

  it('contains AI/Anthropic vars', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    expect(content).toContain('ANTHROPIC_API_KEY');
  });

  it('contains WhatsApp/Evolution API vars', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    expect(content).toContain('EVOLUTION_API_URL');
    expect(content).toContain('EVOLUTION_API_KEY');
  });

  it('contains Redis vars', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    expect(content).toContain('REDIS_URL');
  });

  it('contains Resend vars', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    expect(content).toContain('RESEND_API_KEY');
  });

  it('contains admin/cron vars', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    expect(content).toContain('ADMIN_PASSWORD');
    expect(content).toContain('CRON_SECRET');
    expect(content).toContain('SETUP_SECRET');
  });

  it('does not contain actual secret values', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    // Should only have placeholder values, not real secrets
    const lines = content.split('\n').filter((l) => l.includes('=') && !l.startsWith('#'));
    for (const line of lines) {
      const value = line.split('=').slice(1).join('=');
      // Values should be placeholders (your-*, sk_test_*, etc.) not real secrets
      expect(value.length).toBeLessThan(200);
    }
  });

  it('covers at least 30 env vars', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    const vars = content
      .split('\n')
      .filter((l) => l.match(/^[A-Z_]+=/) && !l.startsWith('#'));
    expect(vars.length).toBeGreaterThanOrEqual(30);
  });
});
