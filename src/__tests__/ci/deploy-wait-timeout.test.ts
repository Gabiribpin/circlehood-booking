import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const ciPath = join(ROOT, '.github/workflows/ci.yml');

describe('CI deploy wait timeout — must fail on timeout (#57)', () => {
  const content = readFileSync(ciPath, 'utf-8');

  it('does NOT silently continue when preview URL is not found', () => {
    // Must not contain fallback warnings that allow silent continuation
    expect(content).not.toContain('usando produção como fallback');
  });

  it('exits with error code 1 when preview URL not found', () => {
    // After "Preview URL não encontrada" it must exit 1
    expect(content).toContain('Preview URL não encontrada');
    // The line after should be exit 1
    const lines = content.split('\n');
    const notFoundLine = lines.findIndex(l => l.includes('Preview URL não encontrada'));
    expect(notFoundLine).toBeGreaterThan(-1);
    const nextLine = lines[notFoundLine + 1]?.trim();
    expect(nextLine).toBe('exit 1');
  });

  it('exits with error code 1 when preview URL does not respond', () => {
    expect(content).toContain('Preview URL não respondeu');
    const lines = content.split('\n');
    const notRespondedLine = lines.findIndex(l => l.includes('Preview URL não respondeu'));
    expect(notRespondedLine).toBeGreaterThan(-1);
    const nextLine = lines[notRespondedLine + 1]?.trim();
    expect(nextLine).toBe('exit 1');
  });

  it('still falls back to prod URL on push events (non-PR)', () => {
    // The prod URL fallback should still exist for push events (line after the if block)
    expect(content).toContain('echo "url=$PROD_URL" >> "$GITHUB_OUTPUT"');
  });
});
