import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROUTE_PATH = join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'gallery',
  'upload',
  'route.ts'
);

describe('Gallery upload file size validation (#107)', () => {
  const source = readFileSync(ROUTE_PATH, 'utf-8');

  it('validates content-length header before parsing FormData', () => {
    // Must check content-length BEFORE request.formData()
    const contentLengthIndex = source.indexOf('content-length');
    const formDataIndex = source.indexOf('request.formData()');

    expect(contentLengthIndex).toBeGreaterThan(-1);
    expect(formDataIndex).toBeGreaterThan(-1);
    expect(contentLengthIndex).toBeLessThan(formDataIndex);
  });

  it('returns 413 for oversized requests', () => {
    expect(source).toContain('status: 413');
  });

  it('defines MAX_REQUEST_SIZE constant', () => {
    expect(source).toMatch(/MAX_REQUEST_SIZE\s*=\s*50\s*\*\s*1024\s*\*\s*1024/);
  });

  it('defines MAX_FILE_SIZE constant (5MB)', () => {
    expect(source).toMatch(/MAX_FILE_SIZE\s*=\s*5\s*\*\s*1024\s*\*\s*1024/);
  });

  it('validates individual file sizes after parsing', () => {
    expect(source).toContain('f.size > MAX_FILE_SIZE');
  });

  it('checks all upload files (file, beforeFile, afterFile)', () => {
    expect(source).toContain('[file, beforeFile, afterFile]');
  });
});
