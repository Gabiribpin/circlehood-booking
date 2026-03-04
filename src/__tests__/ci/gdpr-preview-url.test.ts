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

  it('does not hardcode production URL in a curl polling loop', () => {
    // The old pattern: curl directly against production URL in a loop
    expect(ciYml).not.toContain(
      'curl -sfL --max-time 15 https://booking.circlehood-tech.com/register'
    );
  });

  it('has a step to obtain the Vercel deploy URL', () => {
    expect(ciYml).toContain('id: vercel-url');
    expect(ciYml).toContain('Obter URL do Vercel deploy');
  });

  it('uses GitHub Deployments API to find preview URL on PRs', () => {
    expect(ciYml).toContain('deployments?sha=');
    expect(ciYml).toContain('environment=Preview');
    expect(ciYml).toContain('environment_url');
  });

  it('fails the job when preview is unavailable instead of falling back (#57)', () => {
    expect(ciYml).toContain('https://booking.circlehood-tech.com');
    // Must NOT silently fall back to production — must exit 1
    expect(ciYml).not.toContain('usando produção como fallback');
    expect(ciYml).toContain('deploy não ficou pronto');
    expect(ciYml).toContain('exit 1');
  });

  it('verifies preview URL responds before using it', () => {
    expect(ciYml).toContain('Verificando se preview responde');
    expect(ciYml).toContain('Preview responde');
  });

  it('passes the dynamic URL as TEST_BASE_URL to the GDPR tests', () => {
    expect(ciYml).toContain("TEST_BASE_URL: ${{ steps.vercel-url.outputs.url }}");
  });

  it('does not hardcode TEST_BASE_URL to production in the GDPR job', () => {
    // Extract the GDPR job section
    const gdprMatch = ciYml.match(/gdpr-legal-e2e:[\s\S]*?(?=\n  \w[\w-]*:|$)/);
    expect(gdprMatch).toBeTruthy();
    const gdprSection = gdprMatch![0];

    // TEST_BASE_URL should reference the step output, not a hardcoded URL
    const testBaseUrlLines = gdprSection.split('\n').filter(l => l.includes('TEST_BASE_URL'));
    for (const line of testBaseUrlLines) {
      expect(line).not.toContain('https://booking.circlehood-tech.com');
    }
  });

  it('polls at most 18 times (3 min) instead of 30 times (5 min)', () => {
    // The old code did 30 attempts × 10s = 5 min polling against production
    expect(ciYml).not.toContain('seq 1 30');
    // New code polls max 18 attempts for preview URL
    expect(ciYml).toContain('seq 1 18');
  });
});
