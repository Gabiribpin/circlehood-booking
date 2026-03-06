import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #186: global-error.tsx does not exist.
 * Without it, a root layout crash causes an unrecoverable white screen.
 */

const globalErrorPath = resolve('src/app/global-error.tsx');

describe('global-error.tsx exists and is self-contained (issue #186)', () => {
  const source = existsSync(globalErrorPath)
    ? readFileSync(globalErrorPath, 'utf-8')
    : '';

  it('file exists at src/app/global-error.tsx', () => {
    expect(existsSync(globalErrorPath)).toBe(true);
  });

  it('is a client component', () => {
    expect(source).toMatch(/^['"]use client['"]/);
  });

  it('exports a default function component', () => {
    expect(source).toMatch(/export default function GlobalError/);
  });

  it('accepts error and reset props (Next.js contract)', () => {
    expect(source).toContain('error: Error');
    expect(source).toContain('reset: () => void');
  });

  it('renders its own <html> and <body> tags (Next.js requirement)', () => {
    expect(source).toContain('<html');
    expect(source).toContain('<body');
  });

  it('has a reset/retry button that calls reset()', () => {
    expect(source).toContain('onClick={reset}');
  });

  it('has a link to home page for escape hatch', () => {
    expect(source).toContain('href="/"');
  });

  it('does NOT import from next-intl (i18n may be broken)', () => {
    expect(source).not.toContain('next-intl');
  });

  it('does NOT import from @/ paths (app may be broken)', () => {
    expect(source).not.toMatch(/from ['"]@\//);
  });

  it('does NOT import from lucide-react or other UI libs', () => {
    expect(source).not.toContain('lucide-react');
    expect(source).not.toContain('from "react"');
    // Only 'use client' directive needed, no React import required in modern Next.js
  });

  it('uses inline styles only (CSS may not be loaded)', () => {
    expect(source).not.toContain('className=');
  });

  it('displays error digest when available', () => {
    expect(source).toContain('error.digest');
  });
});
