import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const NOTIFICATION_TYPES = ['day_7', 'day_3', 'day_1'] as const;
type NotificationType = typeof NOTIFICATION_TYPES[number];

const DAYS_MAP: Record<NotificationType, number> = {
  day_7: 7,
  day_3: 3,
  day_1: 1,
};

function getFromEmail() {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL;
  return process.env.NODE_ENV === 'production'
    ? 'noreply@circlehood-tech.com'
    : 'onboarding@resend.dev';
}

function getUrgencyColor(type: NotificationType) {
  if (type === 'day_1') return '#dc2626'; // red
  if (type === 'day_3') return '#ea580c'; // orange
  return '#ca8a04'; // yellow/amber
}

function buildEmailHtml(businessName: string, daysRemaining: number, type: NotificationType): string {
  const color = getUrgencyColor(type);
  const escaped = businessName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const upgradeUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/settings/payment`
    : 'https://booking.circlehood-tech.com/settings/payment';

  const title =
    type === 'day_1'
      ? '🚨 Seu teste expira AMANHÃ!'
      : type === 'day_3'
      ? `⚠️ Seu teste expira em ${daysRemaining} dias!`
      : `🕐 Seu teste expira em ${daysRemaining} dias`;

  const subtitle =
    type === 'day_1'
      ? 'Sua página pública e agendamentos serão pausados em 24 horas.'
      : `Sua página pública será pausada em ${daysRemaining} dias.`;

  const urgencyMsg =
    type === 'day_1'
      ? '⏰ ÚLTIMA CHANCE — Assine agora!'
      : type === 'day_3'
      ? 'Não deixe para a última hora!'
      : 'Garanta sua conta Pro hoje!';

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
      <div style="background:#000;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center;">
        <img src="https://circlehood-booking.vercel.app/branding/circlehood-tech-logo.png"
             alt="CircleHood" width="40" height="40"
             style="display:inline-block;vertical-align:middle;margin-right:10px;" />
        <span style="color:#fff;font-size:16px;font-weight:700;vertical-align:middle;">CircleHood Booking</span>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 4px;color:#111;">${title}</h2>
        <p style="color:#555;margin:0 0 20px;">${subtitle}</p>

        <div style="background:${color}18;border-left:4px solid ${color};padding:16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-weight:600;color:${color};">⚠️ Quando expirar:</p>
          <ul style="margin:0;padding-left:20px;color:#555;font-size:14px;line-height:1.8;">
            <li>Sua página pública é desativada</li>
            <li>Novos agendamentos são bloqueados</li>
            <li>Bot do WhatsApp é pausado</li>
          </ul>
        </div>

        <p style="color:#555;font-size:14px;margin:0 0 16px;">
          Olá <strong>${escaped}</strong>, assine o Plano Pro para continuar recebendo agendamentos sem interrupção.
        </p>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="${upgradeUrl}"
             style="display:inline-block;background:${color};color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">
            Assinar Plano Pro Agora →
          </a>
        </div>

        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="margin:0 0 8px;font-weight:600;color:#111;font-size:14px;">✅ Plano Pro inclui:</p>
          <ul style="margin:0;padding-left:20px;color:#555;font-size:13px;line-height:1.8;">
            <li>Página pública sempre ativa</li>
            <li>Agendamentos ilimitados</li>
            <li>Bot do WhatsApp com IA</li>
            <li>Notificações automáticas</li>
            <li>Analytics completo</li>
          </ul>
        </div>

        <p style="color:${color};font-weight:700;font-size:14px;text-align:center;margin:0 0 16px;">
          ${urgencyMsg}
        </p>

        <p style="color:#999;font-size:12px;margin:0;">
          Dúvidas? Acesse o painel ou responda este email.
        </p>

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
          <p style="color:#999;font-size:11px;margin:0;">by <strong>CircleHood Tech</strong></p>
        </div>
      </div>
    </div>
  `;
}

/**
 * POST /api/cron/send-trial-expiration-notifications
 *
 * Sends trial expiration warning emails on days 7, 3 and 1 before expiry.
 * Protected by CRON_SECRET. Runs daily via Vercel cron.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = getFromEmail();

  const now = new Date();

  const breakdown: Record<NotificationType, number> = { day_7: 0, day_3: 0, day_1: 0 };
  let totalSent = 0;
  let processed = 0;

  // Fetch all professionals still on trial with a future end date (within 10 days)
  const windowEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('id, business_name, user_id, trial_ends_at')
    .eq('subscription_status', 'trial')
    .gte('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', windowEnd.toISOString());

  if (error) {
    console.error('[send-trial-expiration-notifications] query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!professionals || professionals.length === 0) {
    return NextResponse.json({ success: true, total_sent: 0, breakdown, processed: 0 });
  }

  // Fetch auth users emails in bulk
  const userIds = professionals.map((p) => p.user_id);
  const emailMap: Record<string, string> = {};

  // Fetch emails from auth.users via admin API (batch by chunks of 50)
  for (let i = 0; i < userIds.length; i += 50) {
    const chunk = userIds.slice(i, i + 50);
    for (const uid of chunk) {
      const { data: userData } = await supabase.auth.admin.getUserById(uid);
      if (userData?.user?.email) {
        emailMap[uid] = userData.user.email;
      }
    }
  }

  for (const professional of professionals) {
    processed++;

    const trialEnd = new Date(professional.trial_ends_at);
    const msRemaining = trialEnd.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    // Determine which notification type to send today
    let notificationType: NotificationType | null = null;
    for (const type of NOTIFICATION_TYPES) {
      if (daysRemaining === DAYS_MAP[type]) {
        notificationType = type;
        break;
      }
    }

    if (!notificationType) continue;

    // Check if already sent
    const { data: existing } = await supabase
      .from('trial_expiration_notifications')
      .select('id')
      .eq('professional_id', professional.id)
      .eq('notification_type', notificationType)
      .maybeSingle();

    if (existing) continue;

    const email = emailMap[professional.user_id];
    if (!email) continue;

    // Send email
    try {
      const subject =
        notificationType === 'day_1'
          ? `🚨 Seu teste CircleHood expira amanhã — ${professional.business_name}`
          : `⚠️ Seu teste CircleHood expira em ${daysRemaining} dias — ${professional.business_name}`;

      await resend.emails.send({
        from: `CircleHood Booking <${fromEmail}>`,
        to: email,
        subject,
        html: buildEmailHtml(professional.business_name, daysRemaining, notificationType),
      });

      // Record the notification
      await supabase.from('trial_expiration_notifications').insert({
        professional_id: professional.id,
        notification_type: notificationType,
        sent_at: now.toISOString(),
      });

      breakdown[notificationType]++;
      totalSent++;
    } catch (emailErr) {
      console.error(`[send-trial-expiration-notifications] error for ${professional.id}:`, emailErr);
    }
  }

  // Log to cron_logs
  try {
    await supabase.from('cron_logs').insert({
      job_name: 'send-trial-expiration-notifications',
      status: 'success',
      message: `Sent ${totalSent} notifications. Breakdown: ${JSON.stringify(breakdown)}`,
      records_processed: processed,
    } as never);
  } catch { /* non-fatal */ }

  return NextResponse.json({
    success: true,
    total_sent: totalSent,
    breakdown,
    processed,
  });
}
