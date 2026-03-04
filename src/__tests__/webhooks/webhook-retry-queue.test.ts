import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('Webhook Retry Queue — Integration', () => {
  it('migration file exists with webhook_failures table', () => {
    const migrationPath = join(ROOT, 'supabase/migrations/20260305000001_webhook_failures.sql');
    expect(existsSync(migrationPath)).toBe(true);
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content).toContain('webhook_failures');
    expect(content).toContain('webhook_type');
    expect(content).toContain('payload');
    expect(content).toContain('attempt_count');
    expect(content).toContain('max_attempts');
    expect(content).toContain('next_retry_at');
    expect(content).toContain('dead_letter');
    expect(content).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('migration has proper indexes for retry processing', () => {
    const migrationPath = join(ROOT, 'supabase/migrations/20260305000001_webhook_failures.sql');
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content).toContain('idx_webhook_failures_retry');
    expect(content).toContain('idx_webhook_failures_type');
  });

  it('cron route exists for processing retries', () => {
    const cronPath = join(ROOT, 'src/app/api/cron/process-webhook-retries/route.ts');
    expect(existsSync(cronPath)).toBe(true);
    const content = readFileSync(cronPath, 'utf-8');
    expect(content).toContain('processWebhookRetries');
    expect(content).toContain('CRON_SECRET');
    expect(content).toContain('process-webhook-retries');
  });

  it('vercel.json includes cron for process-webhook-retries', () => {
    const vercelPath = join(ROOT, 'vercel.json');
    const content = readFileSync(vercelPath, 'utf-8');
    const config = JSON.parse(content);
    const cron = config.crons.find((c: any) => c.path === '/api/cron/process-webhook-retries');
    expect(cron).toBeDefined();
    expect(cron.schedule).toBe('*/10 * * * *');
  });

  it('retry-queue library has recordWebhookFailure and processWebhookRetries', () => {
    const queuePath = join(ROOT, 'src/lib/webhooks/retry-queue.ts');
    expect(existsSync(queuePath)).toBe(true);
    const content = readFileSync(queuePath, 'utf-8');
    expect(content).toContain('recordWebhookFailure');
    expect(content).toContain('processWebhookRetries');
    expect(content).toContain('replayWebhook');
    expect(content).toContain('dead_letter');
  });

  it('admin webhook-failures page exists', () => {
    const pagePath = join(ROOT, 'src/app/[locale]/(admin)/admin/webhook-failures/page.tsx');
    expect(existsSync(pagePath)).toBe(true);
    const content = readFileSync(pagePath, 'utf-8');
    expect(content).toContain('WebhookRetryButton');
    expect(content).toContain('dead_letter');
    expect(content).toContain('webhook_failures');
  });

  it('admin API route exists for listing and manual retry', () => {
    const apiPath = join(ROOT, 'src/app/api/admin/webhook-failures/route.ts');
    expect(existsSync(apiPath)).toBe(true);
    const content = readFileSync(apiPath, 'utf-8');
    expect(content).toContain('GET');
    expect(content).toContain('POST');
    expect(content).toContain('validateAdminToken');
    expect(content).toContain('failureId');
  });

  it('admin layout has webhook failures link', () => {
    const layoutPath = join(ROOT, 'src/app/[locale]/(admin)/layout.tsx');
    const content = readFileSync(layoutPath, 'utf-8');
    expect(content).toContain('webhook-failures');
    expect(content).toContain('Webhook Retries');
  });

  it('webhook retry button component exists', () => {
    const btnPath = join(ROOT, 'src/components/admin/webhook-retry-button.tsx');
    expect(existsSync(btnPath)).toBe(true);
    const content = readFileSync(btnPath, 'utf-8');
    expect(content).toContain("'use client'");
    expect(content).toContain('failureId');
    expect(content).toContain('/api/admin/webhook-failures');
  });
});
