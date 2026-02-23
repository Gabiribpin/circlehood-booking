import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Strip locale prefix (e.g. /en-US/dashboard → /dashboard) for path checks
  const localeMatch = pathname.match(/^\/(en-US|es-ES)(\/|$)/);
  const localePrefix = localeMatch ? localeMatch[1] : '';
  const pathWithoutLocale = localePrefix
    ? pathname.replace(`/${localePrefix}`, '') || '/'
    : pathname;

  // Protect dashboard routes (with or without locale prefix)
  if (!user && pathWithoutLocale.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = localePrefix ? `/${localePrefix}/login` : '/login';
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login page only
  // (/register is allowed while logged in — needed to complete professional setup)
  if (user && pathWithoutLocale === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = localePrefix ? `/${localePrefix}/dashboard` : '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
