import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #151: Gallery upload without extension whitelist
 *
 * safeExt() accepted any alphanumeric extension. Now only allows
 * ['jpg', 'jpeg', 'png', 'webp', 'gif'], falling back to 'bin'.
 */

describe('Gallery upload extension whitelist (issue #151)', () => {
  const source = readFileSync(
    resolve('src/app/api/gallery/upload/route.ts'),
    'utf-8',
  );

  it('defines ALLOWED_EXTENSIONS whitelist', () => {
    expect(source).toContain('ALLOWED_EXTENSIONS');
  });

  it('whitelist includes jpg, jpeg, png, webp, gif', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
      expect(source).toContain(`'${ext}'`);
    }
  });

  it('checks extension against whitelist', () => {
    expect(source).toContain('ALLOWED_EXTENSIONS.has(ext)');
  });

  it('falls back to bin for unknown extensions', () => {
    expect(source).toContain("'bin'");
  });

  it('normalizes extension to lowercase', () => {
    expect(source).toContain('.toLowerCase()');
  });

  it('does not accept arbitrary extensions', () => {
    // The old pattern just stripped non-alphanumeric — should no longer exist alone
    // New pattern must include whitelist check
    const safeExtSection = source.slice(
      source.indexOf('safeExt'),
      source.indexOf('safeExt') + 300,
    );
    expect(safeExtSection).toContain('ALLOWED_EXTENSIONS');
  });
});
