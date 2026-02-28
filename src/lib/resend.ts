import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function getFromEmail() {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL;
  return process.env.NODE_ENV === 'production'
    ? 'noreply@circlehood-tech.com'
    : 'onboarding@resend.dev';
}

interface BookingEmailData {
  clientName: string;
  clientEmail?: string;
  professionalEmail: string;
  businessName: string;
  serviceName: string;
  servicePrice: number;
  currency: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  // Tracking (opcional — usado para gravar em notification_logs)
  bookingId?: string;
  professionalId?: string;
}

/** Grava resultado de envio de email em notification_logs para observabilidade. */
async function logEmailResult(opts: {
  professionalId: string;
  bookingId: string;
  recipient: string;
  message: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from('notification_logs').insert({
      professional_id: opts.professionalId,
      booking_id: opts.bookingId,
      type: 'booking_confirmation',
      channel: 'email',
      recipient: opts.recipient,
      message: opts.message,
      status: opts.status,
      error_message: opts.errorMessage ?? null,
    });
  } catch (logErr) {
    // Nunca quebrar o fluxo por falha de log
    console.error('[Resend] Falha ao gravar notification_logs:', logErr);
  }
}

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '\u20AC', GBP: '\u00A3', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency?.toUpperCase()] || currency;
  return `${symbol}${Number(price).toFixed(2)}`;
}

interface CancellationEmailData {
  clientName: string;
  clientEmail: string;
  businessName: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
  cancellationReason?: string;
  bookingId?: string;
  professionalId?: string;
}

export async function sendCancellationEmail(data: CancellationEmailData): Promise<void> {
  const {
    clientName,
    clientEmail,
    businessName,
    serviceName,
    bookingDate,
    startTime,
    cancellationReason,
    bookingId,
    professionalId,
  } = data;

  const formattedDate = bookingDate.split('-').reverse().join('/');
  const formattedStart = startTime.slice(0, 5);

  const resend = getResend();
  const fromEmail = getFromEmail();

  const emailHeader = `
    <div style="background:#000;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center;">
      <img src="https://circlehood-booking.vercel.app/branding/circlehood-tech-logo.png"
           alt="CircleHood Tech" width="48" height="48"
           style="display:inline-block;vertical-align:middle;margin-right:10px;" />
      <span style="color:#fff;font-size:16px;font-weight:700;vertical-align:middle;">CircleHood Booking</span>
    </div>`;

  const emailFooter = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
      <p style="color:#999;font-size:11px;margin:0;">
        by <strong>CircleHood Tech</strong> · Plataforma de agendamento profissional
      </p>
    </div>`;

  const reasonSection = cancellationReason
    ? `<p style="color:#666;font-size:14px;margin-top:8px;"><strong>Motivo:</strong> ${cancellationReason}</p>`
    : '';

  const subject = `Agendamento cancelado - ${businessName}`;

  const result = await resend.emails.send({
    from: `${businessName} via CircleHood <${fromEmail}>`,
    to: clientEmail,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:24px;">
          <h2 style="margin:0 0 8px;">Agendamento cancelado 😔</h2>
          <p style="color:#666;margin:0 0 16px;">Olá ${clientName}, infelizmente seu agendamento foi cancelado:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#666;">Serviço</td><td style="padding:8px 0;font-weight:600;">${serviceName}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Data</td><td style="padding:8px 0;font-weight:600;">${formattedDate}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Horário</td><td style="padding:8px 0;font-weight:600;">${formattedStart}</td></tr>
          </table>
          ${reasonSection}
          <p style="margin-top:24px;color:#666;font-size:14px;">
            Pedimos desculpas pelo transtorno. Entre em contato com ${businessName} para reagendar.
          </p>
          ${emailFooter}
        </div>
      </div>
    `,
  });

  const hasError = (result as any)?.error;
  if (bookingId && professionalId) {
    await logEmailResult({
      professionalId,
      bookingId,
      recipient: clientEmail,
      message: subject,
      status: hasError ? 'failed' : 'sent',
      errorMessage: hasError ? JSON.stringify((result as any).error) : undefined,
    });
  }

  if (hasError) {
    throw new Error(`Resend cancellation error: ${JSON.stringify((result as any).error)}`);
  }
}

// ─── Ticket reply email ───────────────────────────────────────────────────────

interface TicketReplyEmailData {
  professionalEmail: string;
  professionalName: string;
  ticketSubject: string;
  replyMessage: string;
}

export async function sendTicketReplyEmail(data: TicketReplyEmailData): Promise<void> {
  const { professionalEmail, professionalName, ticketSubject, replyMessage } = data;

  const resend = getResend();
  const fromEmail = getFromEmail();

  const emailHeader = `
    <div style="background:#000;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center;">
      <img src="https://circlehood-booking.vercel.app/branding/circlehood-tech-logo.png"
           alt="CircleHood Tech" width="48" height="48"
           style="display:inline-block;vertical-align:middle;margin-right:10px;" />
      <span style="color:#fff;font-size:16px;font-weight:700;vertical-align:middle;">CircleHood Booking</span>
    </div>`;

  const emailFooter = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
      <p style="color:#999;font-size:11px;margin:0;">
        by <strong>CircleHood Tech</strong> · Suporte &amp; Ajuda
      </p>
    </div>`;

  const subject = `Re: ${ticketSubject}`;

  const result = await resend.emails.send({
    from: `CircleHood Suporte <${fromEmail}>`,
    to: professionalEmail,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:24px;">
          <h2 style="margin:0 0 8px;">Resposta ao seu chamado</h2>
          <p style="color:#666;margin:0 0 8px;">Olá ${professionalName}, nossa equipe respondeu ao seu chamado:</p>
          <p style="color:#666;font-size:13px;margin:0 0 16px;"><strong>Assunto:</strong> ${ticketSubject}</p>
          <div style="background:#f8f8f8;border-left:4px solid #000;padding:16px;border-radius:0 8px 8px 0;margin-bottom:16px;">
            <p style="margin:0;color:#333;font-size:14px;line-height:1.6;">${replyMessage.replace(/\n/g, '<br/>')}</p>
          </div>
          <p style="color:#666;font-size:13px;">
            Acesse o <strong>painel &gt; Suporte</strong> para continuar a conversa ou marcar como resolvido.
          </p>
          ${emailFooter}
        </div>
      </div>
    `,
  });

  const hasError = (result as any)?.error;
  if (hasError) {
    throw new Error(`Resend ticket reply error: ${JSON.stringify((result as any).error)}`);
  }
}

// ─── Booking confirmation email ───────────────────────────────────────────────

export async function sendBookingConfirmationEmail(data: BookingEmailData) {
  const {
    clientName,
    clientEmail,
    professionalEmail,
    businessName,
    serviceName,
    servicePrice,
    currency,
    bookingDate,
    startTime,
    endTime,
    bookingId,
    professionalId,
  } = data;

  const formattedPrice = formatPrice(servicePrice, currency);
  const formattedDate = bookingDate.split('-').reverse().join('/');
  const formattedStart = startTime.slice(0, 5);
  const formattedEnd = endTime.slice(0, 5);

  const resend = getResend();
  const fromEmail = getFromEmail();
  const promises: Promise<unknown>[] = [];

  const emailHeader = `
    <div style="background:#000;padding:16px 24px;border-radius:8px 8px 0 0;text-align:center;">
      <img src="https://circlehood-booking.vercel.app/branding/circlehood-tech-logo.png"
           alt="CircleHood Tech" width="48" height="48"
           style="display:inline-block;vertical-align:middle;margin-right:10px;" />
      <span style="color:#fff;font-size:16px;font-weight:700;vertical-align:middle;">CircleHood Booking</span>
    </div>`;

  const emailFooter = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
      <p style="color:#999;font-size:11px;margin:0;">
        by <strong>CircleHood Tech</strong> · Plataforma de agendamento profissional
      </p>
    </div>`;

  // Email to professional
  promises.push(
    resend.emails.send({
      from: `CircleHood <${fromEmail}>`,
      to: professionalEmail,
      subject: `Novo agendamento: ${clientName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          ${emailHeader}
          <div style="padding:24px;">
            <h2 style="margin:0 0 8px;">Novo agendamento recebido!</h2>
            <p style="color:#666;margin:0 0 16px;">Você recebeu um novo agendamento:</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#666;">Cliente</td><td style="padding:8px 0;font-weight:600;">${clientName}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Serviço</td><td style="padding:8px 0;font-weight:600;">${serviceName}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Data</td><td style="padding:8px 0;font-weight:600;">${formattedDate}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Horário</td><td style="padding:8px 0;font-weight:600;">${formattedStart} - ${formattedEnd}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Valor</td><td style="padding:8px 0;font-weight:600;">${formattedPrice}</td></tr>
            </table>
            <p style="margin-top:24px;color:#666;font-size:14px;">Acesse o dashboard para gerenciar seus agendamentos.</p>
            ${emailFooter}
          </div>
        </div>
      `,
    })
  );

  // Email to client (if email provided)
  if (clientEmail) {
    promises.push(
      resend.emails.send({
        from: `${businessName} via CircleHood <${fromEmail}>`,
        to: clientEmail,
        subject: `Agendamento confirmado - ${businessName}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden;">
            ${emailHeader}
            <div style="padding:24px;">
              <h2 style="margin:0 0 8px;">Agendamento confirmado! 🎉</h2>
              <p style="color:#666;margin:0 0 16px;">Olá ${clientName}, seu agendamento foi confirmado:</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#666;">Serviço</td><td style="padding:8px 0;font-weight:600;">${serviceName}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Data</td><td style="padding:8px 0;font-weight:600;">${formattedDate}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Horário</td><td style="padding:8px 0;font-weight:600;">${formattedStart} - ${formattedEnd}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Valor</td><td style="padding:8px 0;font-weight:600;">${formattedPrice}</td></tr>
              </table>
              <p style="margin-top:24px;color:#666;font-size:14px;">Em caso de dúvidas, entre em contato com ${businessName}.</p>
              ${emailFooter}
            </div>
          </div>
        `,
      })
    );
  }

  const results = await Promise.allSettled(promises);

  // Destinatários na mesma ordem dos promises
  const recipients = [
    { email: professionalEmail, label: 'professional' },
    ...(clientEmail ? [{ email: clientEmail, label: 'client' }] : []),
  ];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const { email, label } = recipients[i];
    const subject =
      label === 'professional'
        ? `Novo agendamento: ${clientName}`
        : `Agendamento confirmado - ${businessName}`;

    if (result.status === 'rejected') {
      const errorMsg = String(result.reason?.message ?? result.reason ?? 'Unknown error');
      console.error(`[Resend] Email ${label} failed:`, errorMsg);
      if (bookingId && professionalId) {
        await logEmailResult({
          professionalId,
          bookingId,
          recipient: email,
          message: subject,
          status: 'failed',
          errorMessage: errorMsg,
        });
      }
    } else {
      const val = result.value as any;
      if (val?.error) {
        const errorMsg = JSON.stringify(val.error);
        console.error(`[Resend] Email ${label} API error:`, errorMsg);
        if (bookingId && professionalId) {
          await logEmailResult({
            professionalId,
            bookingId,
            recipient: email,
            message: subject,
            status: 'failed',
            errorMessage: `Resend API error: ${errorMsg}`,
          });
        }
      } else {
        console.log(`[Resend] Email ${label} sent OK, id:`, val?.data?.id);
        if (bookingId && professionalId) {
          await logEmailResult({
            professionalId,
            bookingId,
            recipient: email,
            message: subject,
            status: 'sent',
          });
        }
      }
    }
  }
}
