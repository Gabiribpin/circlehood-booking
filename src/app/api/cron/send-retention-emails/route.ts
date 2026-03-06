import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getUnsubscribeHeaders, getMarketingEmailFooter } from '@/lib/email/unsubscribe';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@circlehood-tech.com';

  let sent = 0;
  const errors: string[] = [];

  try {
    // Find professionals with pending deletion and their auth email
    const { data: pendingDeletion, error: fetchError } = await supabase
      .from('professionals')
      .select('id, business_name, user_id, deleted_at, deletion_scheduled_for, unsubscribe_token')
      .not('deleted_at', 'is', null)
      .not('deletion_scheduled_for', 'is', null)
      .eq('marketing_emails_opted_out', false);

    if (fetchError) throw fetchError;
    if (!pendingDeletion || pendingDeletion.length === 0) {
      try {
        await supabase.from('cron_logs').insert({
          job_name: 'send-retention-emails',
          status: 'success',
          records_processed: 0,
          execution_time_ms: Date.now() - startTime,
          metadata: { message: 'No pending deletions' },
        } as never);
      } catch { /* non-fatal */ }
      return NextResponse.json({ success: true, sent: 0 });
    }

    const now = new Date();

    for (const prof of pendingDeletion) {
      const deletedAt = new Date(prof.deleted_at);
      const daysSinceDeletion = Math.floor(
        (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine which email type to send (if any)
      let emailType: 'day_7' | 'day_14' | 'day_28' | null = null;
      if (daysSinceDeletion >= 7 && daysSinceDeletion < 8) emailType = 'day_7';
      else if (daysSinceDeletion >= 14 && daysSinceDeletion < 15) emailType = 'day_14';
      else if (daysSinceDeletion >= 28 && daysSinceDeletion < 29) emailType = 'day_28';

      if (!emailType) continue;

      // Check if already sent
      const { data: alreadySent } = await supabase
        .from('retention_emails_sent')
        .select('id')
        .eq('professional_id', prof.id)
        .eq('email_type', emailType)
        .single();

      if (alreadySent) continue;

      // Get email from auth.users
      let userEmail: string | null = null;
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(prof.user_id);
        userEmail = authUser?.user?.email ?? null;
      } catch {
        errors.push(`Could not get email for professional ${prof.id}`);
        continue;
      }

      if (!userEmail) continue;

      const deletionDate = new Date(prof.deletion_scheduled_for);
      const daysRemaining = Math.ceil(
        (deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const formattedDate = deletionDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const emailContent = buildRetentionEmail(
        emailType,
        prof.business_name,
        formattedDate,
        daysRemaining
      );

      try {
        const unsubHeaders = prof.unsubscribe_token
          ? getUnsubscribeHeaders(prof.unsubscribe_token)
          : {};
        const unsubFooter = prof.unsubscribe_token
          ? getMarketingEmailFooter(prof.unsubscribe_token)
          : '';

        await resend.emails.send({
          from: fromEmail,
          to: userEmail,
          subject: emailContent.subject,
          html: emailContent.html + unsubFooter,
          headers: unsubHeaders,
        });

        // Record that email was sent
        await supabase.from('retention_emails_sent').insert({
          professional_id: prof.id,
          email_type: emailType,
        });

        sent++;
        logger.info(
          `[retention-emails] Sent ${emailType} to professional ${prof.id} (${userEmail})`
        );
      } catch (emailError: any) {
        errors.push(`Email failed for ${prof.id}: ${emailError.message}`);
      }
    }

    try {
      await supabase.from('cron_logs').insert({
        job_name: 'send-retention-emails',
        status: 'success',
        records_processed: sent,
        execution_time_ms: Date.now() - startTime,
        metadata: {
          errors_count: errors.length,
          errors,
          professional_ids: pendingDeletion.map((p) => p.id),
        },
      } as never);
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true, sent, errors });
  } catch (error: any) {
    logger.error('[retention-emails] Error:', error);
    try {
      await supabase.from('cron_logs').insert({
        job_name: 'send-retention-emails',
        status: 'error',
        records_processed: sent,
        execution_time_ms: Date.now() - startTime,
        metadata: { error: error.message },
      } as never);
    } catch { /* non-fatal */ }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildRetentionEmail(
  type: 'day_7' | 'day_14' | 'day_28',
  businessName: string,
  deletionDate: string,
  daysRemaining: number
): { subject: string; html: string } {
  const baseStyles = `
    font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #111;
    line-height: 1.6;
  `;
  const buttonStyle = `
    display: inline-block; background: #0070f3; color: #fff;
    padding: 12px 24px; border-radius: 6px; text-decoration: none;
    font-weight: 600; margin: 16px 0;
  `;
  const warningStyle = `
    background: #fff3cd; border-left: 4px solid #f59e0b;
    padding: 12px 16px; border-radius: 4px; margin: 16px 0;
  `;
  const footer = `
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="font-size: 0.8em; color: #888;">
      CircleHood Tech — Dublin, Ireland<br/>
      <a href="mailto:privacy@circlehood-tech.com">privacy@circlehood-tech.com</a>
    </p>
  `;

  const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://booking.circlehood-tech.com'}/settings`;

  if (type === 'day_7') {
    return {
      subject: 'Sentiremos sua falta — CircleHood Booking',
      html: `
        <div style="${baseStyles}">
          <h2>Olá, ${businessName} 👋</h2>
          <p>Notamos que você solicitou a exclusão da sua conta no <strong>CircleHood Booking</strong>.</p>
          <p>Sentiremos muito a sua falta! Sua conta será excluída definitivamente em:</p>
          <p style="font-size: 1.2em; font-weight: bold; color: #e53e3e;">${deletionDate}</p>
          <p>Ainda há <strong>${daysRemaining} dias</strong> para mudar de ideia.</p>
          <div style="${warningStyle}">
            💡 <strong>Mudou de ideia?</strong> Cancele a exclusão agora e continue usando a plataforma.
          </div>
          <a href="${cancelUrl}" style="${buttonStyle}">Cancelar Exclusão</a>
          <p>Se você confirmar a exclusão, todos os seus dados serão removidos permanentemente.</p>
          ${footer}
        </div>
      `,
    };
  }

  if (type === 'day_14') {
    return {
      subject: 'Você está na metade do período — CircleHood Booking',
      html: `
        <div style="${baseStyles}">
          <h2>Olá, ${businessName}!</h2>
          <p>Você está na metade do período de arrependimento. Sua conta será excluída em:</p>
          <p style="font-size: 1.2em; font-weight: bold; color: #e53e3e;">${deletionDate}</p>
          <p>Ainda faltam <strong>${daysRemaining} dias</strong>. Você pode cancelar a qualquer momento.</p>
          <div style="${warningStyle}">
            ⏰ Após essa data, seus dados serão removidos permanentemente e <strong>não poderão ser recuperados</strong>.
          </div>
          <a href="${cancelUrl}" style="${buttonStyle}">Cancelar Exclusão</a>
          ${footer}
        </div>
      `,
    };
  }

  // day_28
  return {
    subject: 'Última chance — sua conta será excluída em 2 dias',
    html: `
      <div style="${baseStyles}">
        <h2 style="color: #e53e3e;">⚠️ Ação urgente necessária</h2>
        <p>Olá, ${businessName}.</p>
        <p>Sua conta no <strong>CircleHood Booking</strong> será <strong>excluída definitivamente</strong> em:</p>
        <p style="font-size: 1.4em; font-weight: bold; color: #e53e3e;">${deletionDate}</p>
        <p>Esta é a sua <strong>última chance</strong> de cancelar a exclusão.</p>
        <div style="${warningStyle}">
          🚨 Após essa data, todos os seus dados — agendamentos, clientes, configurações — serão <strong>removidos permanentemente</strong> e não poderão ser recuperados.
        </div>
        <a href="${cancelUrl}" style="${buttonStyle}">Cancelar Exclusão Agora</a>
        <p style="font-size: 0.9em; color: #666;">Se você não quiser cancelar, não precisa fazer nada.</p>
        ${footer}
      </div>
    `,
  };
}
