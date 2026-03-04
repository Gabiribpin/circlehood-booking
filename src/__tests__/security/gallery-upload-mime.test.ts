import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #138: Gallery upload missing MIME type validation
 *
 * The upload route accepted any file type — exe, php, svg with JS, etc.
 * Now validates MIME type whitelist + magic bytes before uploading.
 */

describe('Gallery upload MIME validation (issue #138)', () => {
  const source = readFileSync(
    resolve('src/app/api/gallery/upload/route.ts'),
    'utf-8'
  );

  it('defines ALLOWED_MIME_TYPES whitelist', () => {
    expect(source).toContain('ALLOWED_MIME_TYPES');
    expect(source).toContain('image/jpeg');
    expect(source).toContain('image/png');
    expect(source).toContain('image/webp');
  });

  it('does not allow SVG (XSS vector)', () => {
    // SVG files can contain JavaScript — must not be in whitelist
    expect(source).not.toContain("'image/svg+xml'");
    expect(source).not.toContain('"image/svg+xml"');
  });

  it('validates magic bytes (not just MIME header)', () => {
    expect(source).toContain('MAGIC_BYTES');
    expect(source).toContain('0xFF, 0xD8, 0xFF'); // JPEG
    expect(source).toContain('0x89, 0x50, 0x4E, 0x47'); // PNG
    expect(source).toContain('0x52, 0x49, 0x46, 0x46'); // WebP (RIFF)
  });

  it('has a validateImageFile function', () => {
    expect(source).toContain('validateImageFile');
  });

  it('calls validateImageFile for each file before upload', () => {
    // Validation must happen before supabase.storage.upload
    const validateIndex = source.indexOf('validateImageFile(f)');
    const uploadIndex = source.indexOf("from('gallery')");
    expect(validateIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeLessThan(uploadIndex);
  });

  it('returns 400 for invalid file types', () => {
    // Find the validation error response
    const validateSection = source.slice(
      source.indexOf('validateImageFile(f)'),
      source.indexOf('validateImageFile(f)') + 200
    );
    expect(validateSection).toContain('400');
  });

  it('validates all files including before/after uploads', () => {
    // filesToCheck should include file, beforeFile, afterFile
    expect(source).toContain('[file, beforeFile, afterFile]');
    // All go through the same validation loop
    expect(source).toContain('for (const f of filesToCheck)');
  });
});
