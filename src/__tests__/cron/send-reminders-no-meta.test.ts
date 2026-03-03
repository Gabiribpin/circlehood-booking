import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #41: Dead code Meta Business API in cron send-reminders
 *
 * Meta Business API was fully removed from the project. The send-reminders
 * cron still had a dead code block handling provider "meta" with
 * graph.facebook.com calls. This test ensures it's been removed.
 */

describe('send-reminders — no Meta Business API dead code (issue #41)', () => {
  const source = readFileSync(
    resolve('src/app/api/cron/send-reminders/route.ts'),
    'utf-8'
  );

  it('does not reference graph.facebook.com', () => {
    expect(source).not.toContain('graph.facebook.com');
  });

  it('does not reference Meta provider', () => {
    expect(source).not.toContain("provider === 'meta'");
    expect(source).not.toContain('provider === "meta"');
  });

  it('does not reference phone_number_id (Meta-only field)', () => {
    expect(source).not.toContain('phone_number_id');
  });

  it('does not reference access_token (Meta-only field)', () => {
    expect(source).not.toContain('access_token');
  });

  it('does not reference messaging_product (Meta API field)', () => {
    expect(source).not.toContain('messaging_product');
  });

  it('still uses Evolution API for sending', () => {
    expect(source).toContain('evolution_api_url');
    expect(source).toContain('evolution_instance');
    expect(source).toContain('/message/sendText/');
  });
});
