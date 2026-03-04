import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const API_DIR = join(__dirname, '..', '..', 'app', 'api');

/**
 * Recursively collect all .ts files in a directory.
 */
function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

describe('API routes do not leak error.message to clients (#106)', () => {
  const allFiles = collectTsFiles(API_DIR);
  // Exclude test files
  const apiFiles = allFiles.filter((f) => !f.includes('__tests__'));

  it('found API route files to check', () => {
    expect(apiFiles.length).toBeGreaterThan(20);
  });

  it('no route returns { error: error.message } in NextResponse.json', () => {
    const violations: string[] = [];

    for (const file of apiFiles) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip cron_logs server-side logging (error_message: is OK)
        if (line.includes('error_message:')) continue;
        // Skip metadata inserts (server-side)
        if (line.includes('metadata:')) continue;
        // Skip internal arrays (errors.push)
        if (line.includes('errors.push')) continue;

        // Check for { error: error.message } pattern in response
        if (
          line.includes('error: error.message') &&
          !line.includes('error_message')
        ) {
          const relPath = file.replace(API_DIR, 'api');
          violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('no route returns message: error.message in NextResponse.json response', () => {
    const violations: string[] = [];

    for (const file of apiFiles) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip cron_logs inserts (error_message: is server-side)
        if (line.includes('error_message:')) continue;
        // Skip metadata inserts
        if (line.includes('metadata:')) continue;

        // message: error.message in response body
        if (line.match(/\bmessage: error\.message\b/)) {
          const relPath = file.replace(API_DIR, 'api');
          violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
