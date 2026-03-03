import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(
  resolve('src/app/api/gallery/upload/route.ts'),
  'utf-8',
);

describe('Gallery upload path traversal prevention (issue #37)', () => {
  it('has a safeExt sanitizer function', () => {
    expect(source).toContain('const safeExt');
    // Must strip non-alphanumeric chars from extension
    expect(source).toContain("replace(/[^a-zA-Z0-9]/g, '')");
  });

  it('uses safeExt for main file extension', () => {
    expect(source).toContain('safeExt(file.name)');
  });

  it('uses safeExt for before/after file extensions', () => {
    expect(source).toContain('safeExt(beforeFile.name)');
    expect(source).toContain('safeExt(afterFile.name)');
  });

  it('does NOT use raw file.name.split for extension extraction', () => {
    expect(source).not.toContain("file.name.split('.').pop()");
    expect(source).not.toContain("beforeFile.name.split('.').pop()");
    expect(source).not.toContain("afterFile.name.split('.').pop()");
  });

  it('safeExt correctly sanitizes malicious filenames', () => {
    // Replicate the safeExt logic from the route
    const safeExt = (name: string) =>
      (name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '');

    // Normal extensions pass through
    expect(safeExt('photo.jpg')).toBe('jpg');
    expect(safeExt('image.png')).toBe('png');

    // Path traversal: slashes and dots stripped from extension
    expect(safeExt('../../etc/passwd')).toBe('etcpasswd');
    expect(safeExt('photo.jpg/../../secret')).toBe('secret');
    expect(safeExt('file.jpg%00.sh')).toBe('sh');

    // All results are safe for path construction (no slashes, no dots)
    const dangerous = ['../../etc/passwd', 'file.jpg/../../../etc/shadow', 'a.b%00.c/d'];
    for (const name of dangerous) {
      const ext = safeExt(name);
      expect(ext).not.toContain('/');
      expect(ext).not.toContain('\\');
      expect(ext).not.toContain('..');
      expect(ext).not.toContain('%');
    }

    // No extension → returns filename itself (sanitized)
    expect(safeExt('noextension')).toBe('noextension');

    // Special chars stripped
    expect(safeExt('file.j/p/g')).toBe('jpg');
  });
});
