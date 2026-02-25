import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { locales, defaultLocale } from './i18n';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip proxy entirely for API routes — they handle their own auth
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

  // If next-intl is redirecting (locale prefix fix), honour it and attach Supabase cookies
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      intlResponse.cookies.set(name, value, options as Parameters<typeof NextResponse.prototype.cookies.set>[2]);
    });
    return intlResponse;
  }

  // 3. Build combined response that:
  //    a) forwards the original request headers (incl. Cookie) to server components
  //    b) honours any URL rewrite next-intl needs (e.g. /admin/support → /pt-BR/admin/support)
  //
  // Why: intlResponse may be NextResponse.rewrite('/pt-BR/...') for default-locale routes.
  // Returning NextResponse.next() instead loses that rewrite → 404.
  // Returning intlResponse as-is loses the Cookie header → cookieCount=0 → Auth session missing.
  //
  // Fix: detect rewrite URL from intlResponse and create the appropriate response type
  // while always forwarding request.headers (which includes Cookie).
  const requestHeaders = new Headers(request.headers);
  intlResponse.headers.forEach((value, key) => {
    if (key.startsWith('x-next-intl-')) {
      requestHeaders.set(key, value);
    }
  });

  const rewriteUrl = intlResponse.headers.get('x-middleware-rewrite');

  const combinedResponse = rewriteUrl
    ? NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  // Copy Set-Cookie from Supabase (auth token refresh) and intl (locale preference)
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    combinedResponse.cookies.set(name, value, options as Parameters<typeof NextResponse.prototype.cookies.set>[2]);
  });
  intlResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    combinedResponse.cookies.set(name, value, options as Parameters<typeof NextResponse.prototype.cookies.set>[2]);
  });

  return combinedResponse;
}

export const config = {
  matcher: [
    // Match all paths except API routes, static files and Next internals
    '/((?!api|_next/static|_next/image|favicon.ico|branding|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
