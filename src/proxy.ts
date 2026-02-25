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

  // If next-intl is redirecting (locale prefix fix), honour it
  // Attach Supabase cookies so the session survives the redirect
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      intlResponse.cookies.set(name, value, options as Parameters<typeof NextResponse.prototype.cookies.set>[2]);
    });
    return intlResponse;
  }

  // 3. Build a combined response that forwards the full request context to server components.
  //
  // Problem: intlResponse is NextResponse.next() without { request }, so server components
  // cannot read the request cookies via cookies() from next/headers — cookieCount = 0.
  //
  // Fix: create a new NextResponse.next({ request: { headers } }) that carries:
  //   - all original request headers (including the Cookie header with auth tokens)
  //   - any headers added by intlMiddleware (e.g. x-next-intl-locale)
  // This makes cookies() in server components return the correct session cookies.
  const requestHeaders = new Headers(request.headers);
  intlResponse.headers.forEach((value, key) => {
    requestHeaders.set(key, value);
  });

  const combinedResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Copy Set-Cookie from both Supabase (auth token refresh) and intl (locale cookie)
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
