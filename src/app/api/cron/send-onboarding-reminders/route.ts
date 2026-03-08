import { logger } from '@/lib/logger';
import { verifyCronSecret } from '@/lib/cron-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getUnsubscribeHeaders, getMarketingEmailFooter } from '@/lib/email/unsubscribe';

const REMINDER_TYPES = ['day_3', 'day_7'] as const;
type ReminderType = typeof REMINDER_TYPES[number];

const DAYS_MAP: Record<ReminderType, number> = {
  day_3: 3,
  day_7: 7,
};

function getFromEmail() {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL;
  return process.env.NODE_ENV === 'production'
    ? 'noreply@circlehood-tech.com'
    : 'onboarding@resend.dev';
}

interface MissingSteps {
  services: boolean;
  schedule: boolean;
  whatsapp: boolean;
}

function completionPercent(missing: MissingSteps): number {
  const total = 3;
  const done = [!missing.services, !missing.schedule, !missing.whatsapp].filter(Boolean).length;
  return Math.round((done / total) * 100);
}

function buildEmailHtml(
  businessName: string,
  type: ReminderType,
  missing: MissingSteps,
): string {
  const escaped = businessName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://booking.circlehood-tech.com';
  const onboardingUrl = `${baseUrl}/onboarding`;
  const pct = completionPercent(missing);

  const isDay7 = type === 'day_7';
  const title = isDay7
    ? '⏰ Última chance: complete seu setup!'
    : '🚀 Falta pouco para ativar seus agendamentos!';

  const subtitle = isDay7
    ? 'Você criou sua conta há 7 dias e ainda não completou o setup.'
    : 'Você criou sua conta há 3 dias — veja o que falta!';

  const missingItems: string[] = [];
  if (missing.services) missingItems.push('📋 Cadastrar seus serviços');
  if (missing.schedule) missingItems.push('🕐 Configurar horários de atendimento');
  if (missing.whatsapp) missingItems.push('💬 Conectar WhatsApp Bot');

  const urgencyColor = isDay7 ? '#dc2626' : '#2563eb';

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

        <div style="background:#f0f9ff;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:32px;font-weight:700;color:${urgencyColor};">${pct}%</p>
          <p style="margin:0;color:#555;font-size:13px;">do setup concluído</p>
        </div>

        <div style="background:${urgencyColor}10;border-left:4px solid ${urgencyColor};padding:16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-weight:600;color:${urgencyColor};">O que falta:</p>
          <ul style="margin:0;padding-left:20px;color:#555;font-size:14px;line-height:2;">
            ${missingItems.map((item) => `<li>${item}</li>`).join('\n            ')}
          </ul>
        </div>

        <p style="color:#555;font-size:14px;margin:0 0 16px;">
          Olá <strong>${escaped}</strong>, complete esses passos para começar a receber agendamentos automaticamente!
        </p>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="${onboardingUrl}"
             style="display:inline-block;background:${urgencyColor};color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">
            Completar meu setup agora →
          </a>
        </div>

        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="margin:0 0 8px;font-weight:600;color:#111;font-size:14px;">✅ Ao completar o setup:</p>
          <ul style="margin:0;padding-left:20px;color:#555;font-size:13px;line-height:1.8;">
            <li>Sua página pública fica ativa</li>
            <li>Clientes podem agendar direto</li>
            <li>Bot do WhatsApp responde automaticamente</li>
            <li>Você recebe notificações de novos agendamentos</li>
          </ul>
        </div>

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
 * POST /api/cron/send-onboarding-reminders
 *
 * Sends onboarding reminder emails on days 3 and 7 after account creation
 * to professionals who haven't completed the wizard.
 * Protected by CRON_SECRET. Runs daily via Vercel cron.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = getFromEmail();
  const now = new Date();

  const breakdown: Record<ReminderType, number> = { day_3: 0, day_7: 0 };
  let totalSent = 0;
  let processed = 0;

  // Fetch professionals on trial with incomplete onboarding
  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('id, business_name, user_id, created_at, unsubscribe_token')
    .eq('subscription_status', 'trial')
    .eq('onboarding_completed', false)
    .eq('marketing_emails_opted_out', false);

  if (error) {
    logger.error('[send-onboarding-reminders] query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!professionals || professionals.length === 0) {
    await logCron(supabase, startTime, 0, 0, breakdown);
    return NextResponse.json({ success: true, total_sent: 0, breakdown, processed: 0 });
  }

  // Fetch emails in bulk
  const emailMap: Record<string, string> = {};
  for (let i = 0; i < professionals.length; i += 50) {
    const chunk = professionals.slice(i, i + 50);
    for (const p of chunk) {
      const { data: userData } = await supabase.auth.admin.getUserById(p.user_id);
      if (userData?.user?.email) {
        emailMap[p.user_id] = userData.user.email;
      }
    }
  }

  for (const professional of professionals) {
    processed++;

    const createdAt = new Date(professional.created_at);
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Determine which reminder to send
    let reminderType: ReminderType | null = null;
    for (const type of REMINDER_TYPES) {
      if (daysSinceCreation === DAYS_MAP[type]) {
        reminderType = type;
        break;
      }
    }

    if (!reminderType) continue;

    // Check if already sent
    const { data: existing } = await supabase
      .from('onboarding_reminders_sent')
      .select('id')
      .eq('professional_id', professional.id)
      .eq('reminder_type', reminderType)
      .maybeSingle();

    if (existing) continue;

    const email = emailMap[professional.user_id];
    if (!email) continue;

    // Check which onboarding steps are missing
    const missing = await checkMissingSteps(supabase, professional.id);

    try {
      const subject = reminderType === 'day_7'
        ? `⏰ Última chance: complete seu setup — ${professional.business_name}`
        : `🚀 Falta pouco para ativar! — ${professional.business_name}`;

      const unsubHeaders = professional.unsubscribe_token
        ? getUnsubscribeHeaders(professional.unsubscribe_token)
        : {};
      const unsubFooter = professional.unsubscribe_token
        ? getMarketingEmailFooter(professional.unsubscribe_token)
        : '';

      await resend.emails.send({
        from: `CircleHood Booking <${fromEmail}>`,
        to: email,
        subject,
        html: buildEmailHtml(professional.business_name, reminderType, missing) + unsubFooter,
        headers: unsubHeaders,
      });

      // Record the reminder
      await supabase.from('onboarding_reminders_sent').insert({
        professional_id: professional.id,
        reminder_type: reminderType,
        sent_at: now.toISOString(),
      } as never);

      breakdown[reminderType]++;
      totalSent++;

      logger.info(
        `[send-onboarding-reminders] Sent ${reminderType} to ${professional.id} (${professional.business_name})`,
      );
    } catch (emailErr) {
      logger.error(`[send-onboarding-reminders] error for ${professional.id}:`, emailErr);
    }
  }

  await logCron(supabase, startTime, processed, totalSent, breakdown);

  return NextResponse.json({
    success: true,
    total_sent: totalSent,
    breakdown,
    processed,
  });
}

async function checkMissingSteps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  professionalId: string,
): Promise<MissingSteps> {
  const [servicesRes, scheduleRes, whatsappRes] = await Promise.all([
    supabase.from('services').select('id').eq('professional_id', professionalId).limit(1),
    supabase.from('working_hours').select('id').eq('professional_id', professionalId).limit(1),
    supabase
      .from('whatsapp_config')
      .select('is_active')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  return {
    services: !servicesRes.data || servicesRes.data.length === 0,
    schedule: !scheduleRes.data || scheduleRes.data.length === 0,
    whatsapp: !whatsappRes.data,
  };
}

async function logCron(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  startTime: number,
  processed: number,
  totalSent: number,
  breakdown: Record<ReminderType, number>,
) {
  try {
    await supabase.from('cron_logs').insert({
      job_name: 'send-onboarding-reminders',
      status: 'success',
      records_processed: processed,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        message: `Sent ${totalSent} reminders. Breakdown: ${JSON.stringify(breakdown)}`,
      },
    } as never);
  } catch { /* non-fatal */ }
}
