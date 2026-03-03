import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateEmail, generateVerificationToken } from '@/lib/email-validation';
import { Resend } from 'resend';

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
        <img src="https://circlehood-booking.vercel.app/branding/circlehood-tech-logo.png"
             alt="CircleHood Tech" width="40" height="40"
             style="display:inline-block;vertical-align:middle;margin-right:10px;" />
        <span style="color:#fff;font-size:16px;font-weight:700;vertical-align:middle;">CircleHood Booking</span>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 8px;">Confirme seu email 📧</h2>
        <p style="color:#555;margin:0 0 20px;line-height:1.5;">
          Olá! Clique no botão abaixo para confirmar seu email e ativar sua conta
          <strong>${escaped}</strong> no CircleHood Booking.
        </p>
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${verifyUrl}"
             style="display:inline-block;background:#000;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
            ✅ Confirmar Email
          </a>
        </div>
        <p style="color:#999;font-size:12px;margin:0 0 8px;">
          Link válido por <strong>24 horas</strong>. Se não criou uma conta, pode ignorar este email.
        </p>
        <p style="color:#bbb;font-size:11px;word-break:break-all;margin:0;">
          Ou copie: <a href="${verifyUrl}" style="color:#888;">${verifyUrl}</a>
        </p>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
          <p style="color:#999;font-size:11px;margin:0;">by <strong>CircleHood Tech</strong> · Plataforma de agendamento</p>
        </div>
      </div>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const { email, password, slug, businessName, category, city, country, currency, locale } = body;

  if (!email || !password || !slug || !businessName) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Validate email format + domain
  const emailValidation = validateEmail(normalizedEmail);
  if (!emailValidation.valid) {
    return NextResponse.json({ error: emailValidation.error }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 2. Create Supabase Auth user (email_confirm: true so signInWithPassword works;
  //    our own email_verified flag gates dashboard access)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? '';
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return NextResponse.json({ error: 'Este email já está cadastrado.' }, { status: 400 });
    }
    return NextResponse.json({ error: msg || 'Erro ao criar conta.' }, { status: 400 });
  }

  // 3. Create professional profile with email_verified = false
  const { data: professional, error: profileError } = await supabase
    .from('professionals')
    .insert({
      user_id: authData.user.id,
      slug,
      business_name: businessName,
      category: category || null,
      city: city || 'Dublin',
      country: country || 'IE',
      currency: currency || 'eur',
      email_verified: false,
      locale: locale || 'pt-BR',
    })
    .select('id')
    .single();

  if (profileError || !professional) {
    logger.error('[signup-with-verification] profile insert error:', profileError);
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: 'Erro ao criar perfil. Tente novamente.' }, { status: 500 });
  }

  // 4. Create verification token (24h expiry)
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenError } = await supabase
    .from('email_verification_tokens')
    .insert({ professional_id: professional.id, token, expires_at: expiresAt });

  if (tokenError) {
    logger.error('[signup-with-verification] token insert error:', tokenError);
    // Non-fatal — user can resend via /api/auth/resend-verification-email
  }

  // 5. Send verification email
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://booking.circlehood-tech.com';
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: `CircleHood Booking <${getFromEmail()}>`,
      to: normalizedEmail,
      subject: 'Confirme seu email — CircleHood Booking',
      html: buildVerificationEmailHtml(businessName, verifyUrl),
    });
  } catch (emailErr) {
    logger.error('[signup-with-verification] email send error:', emailErr);
    // Non-fatal — user can resend
  }

  return NextResponse.json({ success: true });
}
