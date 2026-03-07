import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRateLimited } from '@/lib/rate-limit';

/**
 * GET /api/auth/verify-email?token=XXXX
 *
 * Validates a custom email verification token, marks the professional's
 * email as verified, and redirects to /login?verified=true.
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://booking.circlehood-tech.com';

  // Rate limiting por IP — 10 attempts per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await isRateLimited(`verify:${ip}`, 10, 3600)) {
    return NextResponse.redirect(`${baseUrl}/login?error=too_many_attempts`);
  }

  const token = req.nextUrl.searchParams.get('token');

  if (!token || token.length < 32) {
    return NextResponse.redirect(`${baseUrl}/login?error=token_invalid`);
  }

  const supabase = createAdminClient();

  // Look up the token
  const { data: tokenRow, error } = await supabase
    .from('email_verification_tokens')
    .select('id, professional_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !tokenRow) {
    return NextResponse.redirect(`${baseUrl}/login?error=token_invalid`);
  }

  if (tokenRow.used_at) {
    return NextResponse.redirect(`${baseUrl}/login?verified=true`);
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.redirect(`${baseUrl}/login?error=token_expired`);
  }

  // Mark token as used
  await supabase
    .from('email_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  // Mark professional's email as verified
  await supabase
    .from('professionals')
    .update({ email_verified: true })
    .eq('id', tokenRow.professional_id);

  return NextResponse.redirect(`${baseUrl}/login?verified=true`);
}
