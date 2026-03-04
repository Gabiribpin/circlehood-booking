import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const content = readFileSync(join(ROOT, 'e2e/legal-pages.spec.ts'), 'utf-8');

describe('Legal pages E2E has cross-link tests for all locales (#59)', () => {
  it('EN-US privacy has cross-link test to terms', () => {
    expect(content).toContain('/en-US/privacy');
    expect(content).toMatch(/en-US\/privacy[\s\S]*?a\[href\*="\/terms"\]/);
  });

  it('ES-ES privacy has cross-link test to terms', () => {
    expect(content).toContain('/es-ES/privacy');
    expect(content).toMatch(/es-ES\/privacy[\s\S]*?a\[href\*="\/terms"\]/);
  });

  it('EN-US terms has cross-link test to privacy', () => {
    expect(content).toContain('/en-US/terms');
    expect(content).toMatch(/en-US\/terms[\s\S]*?a\[href\*="\/privacy"\]/);
  });

  it('ES-ES terms has cross-link test to privacy', () => {
    expect(content).toContain('/es-ES/terms');
    expect(content).toMatch(/es-ES\/terms[\s\S]*?a\[href\*="\/privacy"\]/);
  });
});
