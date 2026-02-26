import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/auth/verify-email?token=XXXX
 *
 * Validates a custom email verification token, marks the professional's
 * email as verified, and redirects to /login?verified=true.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://booking.circlehood-tech.com';

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
