import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #60: Remove CRON_SECRET from gdpr-legal-e2e job env
 *
 * CRON_SECRET was exposed unnecessarily in the GDPR job — none of the
 * tests it runs use it. Follows the principle of least privilege.
 */

describe('gdpr-legal-e2e job does not expose CRON_SECRET (issue #60)', () => {
  const ciYml = readFileSync(resolve('.github/workflows/ci.yml'), 'utf-8');

  // Extract the GDPR job section
  const gdprMatch = ciYml.match(/gdpr-legal-e2e:[\s\S]*?(?=\n  \w[\w-]*:|$)/);

  it('GDPR job section exists in ci.yml', () => {
    expect(gdprMatch).toBeTruthy();
  });

  it('does not include CRON_SECRET in the GDPR job env', () => {
    const gdprSection = gdprMatch![0];
    expect(gdprSection).not.toContain('CRON_SECRET');
  });

  it('still includes required secrets for GDPR tests', () => {
    const gdprSection = gdprMatch![0];
    expect(gdprSection).toContain('TEST_USER_EMAIL');
    expect(gdprSection).toContain('TEST_USER_PASSWORD');
    expect(gdprSection).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(gdprSection).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
