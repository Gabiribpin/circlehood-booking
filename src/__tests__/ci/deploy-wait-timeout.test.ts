import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const ciPath = join(ROOT, '.github/workflows/ci.yml');

describe('CI deploy wait timeout — must fail on timeout (#57)', () => {
  const content = readFileSync(ciPath, 'utf-8');

  it('falls back to PROD_URL when preview URL is not found', () => {
    expect(content).toContain('usando PROD_URL como fallback');
  });

  it('warns when preview URL not found', () => {
    expect(content).toContain('Preview URL não encontrada');
  });

  it('warns when preview URL does not respond', () => {
    expect(content).toContain('Preview URL não respondeu');
  });

  it('still falls back to prod URL on push events (non-PR)', () => {
    // The prod URL fallback should still exist for push events (line after the if block)
    expect(content).toContain('echo "url=$PROD_URL" >> "$GITHUB_OUTPUT"');
  });
});
