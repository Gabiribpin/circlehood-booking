import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const configSource = readFileSync(resolve('next.config.ts'), 'utf-8');

describe('Security headers (issue #14)', () => {
  it('sets X-Frame-Options: DENY to prevent clickjacking', () => {
    expect(configSource).toContain("key: 'X-Frame-Options', value: 'DENY'");
  });

  it('sets X-Content-Type-Options: nosniff to prevent MIME sniffing', () => {
    expect(configSource).toContain(
      "key: 'X-Content-Type-Options', value: 'nosniff'",
    );
  });

  it('sets Referrer-Policy to prevent token leakage via Referer header', () => {
    expect(configSource).toContain(
      "key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'",
    );
  });

  it('sets Permissions-Policy to restrict sensitive APIs', () => {
    expect(configSource).toContain(
      "key: 'Permissions-Policy', value: 'geolocation=(), microphone=()'",
    );
  });

  it('applies headers to all routes via catch-all source', () => {
    expect(configSource).toContain("source: '/(.*)'");
  });

  it('exports async headers() function in nextConfig', () => {
    expect(configSource).toContain('async headers()');
  });

  it('sets Content-Security-Policy with default-src self', () => {
    expect(configSource).toContain("key: 'Content-Security-Policy'");
    expect(configSource).toContain("default-src 'self'");
  });

  it('CSP allows Stripe scripts and frames', () => {
    expect(configSource).toContain('https://js.stripe.com');
    expect(configSource).toContain('https://hooks.stripe.com');
  });

  it('CSP allows Supabase connections and images', () => {
    expect(configSource).toContain('https://*.supabase.co');
  });

  it('CSP sets frame-ancestors none to prevent framing', () => {
    expect(configSource).toContain("frame-ancestors 'none'");
  });

  it('sets Strict-Transport-Security with max-age and preload', () => {
    expect(configSource).toContain("key: 'Strict-Transport-Security'");
    expect(configSource).toContain('max-age=31536000');
    expect(configSource).toContain('includeSubDomains');
    expect(configSource).toContain('preload');
  });
});
