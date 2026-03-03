import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateVerificationToken } from '@/lib/email-validation';
import { Resend } from 'resend';

const RATE_LIMIT_MINUTES = 5;

function getFromEmail() {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL;
  return process.env.NODE_ENV === 'production'
    ? 'noreply@circlehood-tech.com'
    : 'onboarding@resend.dev';
}

function buildVerificationEmailHtml(businessName: string, verifyUrl: string): string {
  const escaped = businessName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
      <div style="background:#000;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center;">
        <span style="color:#fff;font-size:16px;font-weight:700;">CircleHood Booking</span>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 8px;">Confirme seu email 📧</h2>
        <p style="color:#555;margin:0 0 20px;line-height:1.5;">
          Novo link de confirmação para <strong>${escaped}</strong>:
        </p>
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${verifyUrl}"
             style="display:inline-block;background:#000;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
            ✅ Confirmar Email
          </a>
        </div>
        <p style="color:#999;font-size:12px;margin:0 0 8px;">Link válido por <strong>24 horas</strong>.</p>
        <p style="color:#bbb;font-size:11px;word-break:break-all;margin:0;">
          Ou copie: <a href="${verifyUrl}" style="color:#888;">${verifyUrl}</a>
        </p>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
          <p style="color:#999;font-size:11px;margin:0;">by <strong>CircleHood Tech</strong></p>
        </div>
      </div>
    </div>
  `;
}

/**
 * POST /api/auth/resend-verification-email
 * Re-sends the custom email verification link.
 * Rate-limited to once per 5 minutes (checks last token created_at).
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get professional
  const { data: professional } = await admin
    .from('professionals')
    .select('id, business_name, email_verified')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!professional) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });
  }

  if (professional.email_verified) {
    return NextResponse.json({ error: 'Email já verificado.' }, { status: 400 });
  }

  // Rate limiting: check most recent token
  const { data: lastToken } = await admin
    .from('email_verification_tokens')
    .select('created_at')
    .eq('professional_id', professional.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastToken) {
    const elapsed = (Date.now() - new Date(lastToken.created_at).getTime()) / 60000;
    if (elapsed < RATE_LIMIT_MINUTES) {
      const waitMin = Math.ceil(RATE_LIMIT_MINUTES - elapsed);
      return NextResponse.json(
        { error: `Aguarde ${waitMin} minuto(s) antes de reenviar.` },
        { status: 429 }
      );
    }
  }

  // Generate new token
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenError } = await admin
    .from('email_verification_tokens')
    .insert({ professional_id: professional.id, token, expires_at: expiresAt });

  if (tokenError) {
    logger.error('[resend-verification-email] token insert error:', tokenError);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }

  // Send email
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://booking.circlehood-tech.com';
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: `CircleHood Booking <${getFromEmail()}>`,
      to: user.email!,
      subject: 'Novo link de verificação — CircleHood Booking',
      html: buildVerificationEmailHtml(professional.business_name, verifyUrl),
    });
  } catch (emailErr) {
    logger.error('[resend-verification-email] email send error:', emailErr);
    return NextResponse.json({ error: 'Erro ao enviar email. Tente novamente.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
