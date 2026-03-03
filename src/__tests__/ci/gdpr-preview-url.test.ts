import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #54: GDPR test polls production URL instead of Vercel preview
 *
 * The GDPR E2E job was polling booking.circlehood-tech.com (production) to check
 * if the Vercel deploy was ready. On PRs this never succeeds — the production URL
 * doesn't update with PR code — wasting 5 minutes on every PR run.
 */

describe('GDPR job uses Vercel preview URL (issue #54)', () => {
  const ciYml = readFileSync(resolve('.github/workflows/ci.yml'), 'utf-8');

  it('does not hardcode production URL in the polling step', () => {
    // The old pattern: curl directly against production URL
    expect(ciYml).not.toContain(
      'curl -sfL --max-time 15 https://booking.circlehood-tech.com/register'
    );
  });

  it('has a step to obtain the Vercel preview URL', () => {
    expect(ciYml).toContain('id: vercel-url');
    expect(ciYml).toContain('Obter URL do Vercel preview deploy');
  });

  it('uses GitHub Deployments API to find preview URL on PRs', () => {
    expect(ciYml).toContain('deployments?sha=');
    expect(ciYml).toContain('environment=Preview');
    expect(ciYml).toContain('environment_url');
  });

  it('falls back to production URL on push to main', () => {
    expect(ciYml).toContain('https://booking.circlehood-tech.com');
    expect(ciYml).toContain('usando URL de produção como fallback');
  });

  it('passes the dynamic URL as TEST_BASE_URL to the GDPR tests', () => {
    expect(ciYml).toContain("TEST_BASE_URL: ${{ steps.vercel-url.outputs.url }}");
  });

  it('does not hardcode TEST_BASE_URL to production in the GDPR job', () => {
    // Extract the GDPR job section (between gdpr-legal-e2e: and the next job)
    const gdprMatch = ciYml.match(/gdpr-legal-e2e:[\s\S]*?(?=\n  \w[\w-]*:|$)/);
    expect(gdprMatch).toBeTruthy();
    const gdprSection = gdprMatch![0];

    // TEST_BASE_URL should reference the step output, not a hardcoded URL
    const testBaseUrlLines = gdprSection.split('\n').filter(l => l.includes('TEST_BASE_URL'));
    for (const line of testBaseUrlLines) {
      expect(line).not.toContain('https://booking.circlehood-tech.com');
    }
  });
});
