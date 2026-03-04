import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

// Extract project-specific Supabase hostname from env (e.g. "abcdef.supabase.co")
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : '';

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseHostname ? `https://${supabaseHostname}` : 'https://*.supabase.co'}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseHostname ? `https://${supabaseHostname}` : 'https://*.supabase.co'} https://api.stripe.com`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=()' },
  { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
            pathname: '/storage/v1/object/**',
          },
        ]
      : [
          // Fallback: accept any Supabase project if env not set (dev only)
          {
            protocol: 'https',
            hostname: '*.supabase.co',
            pathname: '/storage/v1/object/**',
          },
        ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
