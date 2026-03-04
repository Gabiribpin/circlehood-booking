import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('E2E tests use polling instead of fixed waits (#58)', () => {
  it('register-terms.spec.ts does not use waitForTimeout(1500) for slug check', () => {
    const content = readFileSync(join(ROOT, 'e2e/register-terms.spec.ts'), 'utf-8');
    expect(content).not.toContain('waitForTimeout(1500)');
    // Should use animate-spin polling pattern instead
    expect(content).toContain('animate-spin');
    expect(content).toContain('waitForFunction');
  });

  it('import-whatsapp.spec.ts does not use waitForTimeout(3000) for useEffect', () => {
    const content = readFileSync(join(ROOT, 'e2e/import-whatsapp.spec.ts'), 'utf-8');
    expect(content).not.toContain('waitForTimeout(3000)');
    // Should use networkidle or semantic wait instead
    expect(content).toContain('waitForLoadState');
  });

  it('register-terms.spec.ts has no waitForTimeout > 500ms', () => {
    const content = readFileSync(join(ROOT, 'e2e/register-terms.spec.ts'), 'utf-8');
    const matches = content.match(/waitForTimeout\((\d+)\)/g) || [];
    for (const match of matches) {
      const ms = Number(match.match(/\d+/)![0]);
      expect(ms).toBeLessThanOrEqual(500);
    }
  });

  it('import-whatsapp.spec.ts has no waitForTimeout calls at all', () => {
    const content = readFileSync(join(ROOT, 'e2e/import-whatsapp.spec.ts'), 'utf-8');
    expect(content).not.toMatch(/waitForTimeout\(\d+\)/);
  });
});
