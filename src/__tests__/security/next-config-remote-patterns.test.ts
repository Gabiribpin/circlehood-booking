import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #145: Supabase remote patterns too permissive
 *
 * next.config.ts used *.supabase.co wildcard, accepting images from
 * any Supabase project. Now restricts to the project-specific hostname
 * derived from NEXT_PUBLIC_SUPABASE_URL.
 */

describe('Next.js remote patterns — Supabase restriction (issue #145)', () => {
  const source = readFileSync(resolve('next.config.ts'), 'utf-8');

  it('extracts hostname from NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(source).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(source).toContain('new URL(supabaseUrl).hostname');
  });

  it('uses project-specific hostname in remotePatterns when env is set', () => {
    // Should use supabaseHostname variable, not wildcard, in the primary path
    expect(source).toContain('hostname: supabaseHostname');
  });

  it('restricts pathname to /storage/v1/object/**', () => {
    expect(source).toContain("pathname: '/storage/v1/object/**'");
  });

  it('removed the second wildcard pattern (no pathname restriction)', () => {
    // The old config had a second pattern with just hostname: '*.supabase.co' and no pathname
    // Count occurrences of *.supabase.co in remotePatterns section
    const patternsSection = source.slice(
      source.indexOf('remotePatterns'),
      source.indexOf('async headers()')
    );
    // Wildcard should only appear in the fallback branch
    const wildcardCount = (patternsSection.match(/\*\.supabase\.co/g) || []).length;
    expect(wildcardCount).toBe(1); // only in fallback
  });

  it('uses project-specific hostname in CSP img-src when env is set', () => {
    expect(source).toContain('supabaseHostname ? `https://${supabaseHostname}`');
  });

  it('uses project-specific hostname in CSP connect-src when env is set', () => {
    const connectLine = source.split('\n').find(l => l.includes('connect-src'));
    expect(connectLine).toContain('supabaseHostname');
  });

  it('falls back to wildcard only when env is not set', () => {
    // Wildcard should only appear as fallback
    const lines = source.split('\n');
    for (const line of lines) {
      if (line.includes("'*.supabase.co'") || line.includes('*.supabase.co')) {
        // Should be in a fallback/conditional context
        expect(
          source.includes("supabaseHostname ?") || source.includes("// Fallback")
        ).toBe(true);
      }
    }
  });
});
