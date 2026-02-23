import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (avatars, covers, gallery)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      // Supabase Storage via project URL
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
