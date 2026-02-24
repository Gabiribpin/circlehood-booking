import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { locales, defaultLocale } from './i18n';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware entirely for API routes — they handle their own auth
  // and don't need locale detection. Running intlMiddleware on /api/* paths
  // can cause Next.js routing to 404 on valid API routes.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 1. Run Supabase session refresh (handles auth redirects for protected routes)
  const supabaseResponse = await updateSession(request);

  // If Supabase is redirecting (e.g., unauthenticated user to /login), honour it
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    return supabaseResponse;
  }

  // 2. Run next-intl middleware for locale detection / cookie / redirects
  const intlResponse = intlMiddleware(request);

  // If next-intl is redirecting (locale prefix fix), honour it
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // 3. Merge: copy Supabase session cookies into the intl response so they reach the client
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    intlResponse.cookies.set(name, value, options as Parameters<typeof NextResponse.prototype.cookies.set>[2]);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    // Match all paths except API routes, static files and Next internals
    '/((?!api|_next/static|_next/image|favicon.ico|branding|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
