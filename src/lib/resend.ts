import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function getFromEmail() {
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
}

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '\u20AC', GBP: '\u00A3', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(price).toFixed(2)}`;
}

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
  } = data;

  const formattedPrice = formatPrice(servicePrice, currency);
  const formattedDate = bookingDate.split('-').reverse().join('/');
  const formattedStart = startTime.slice(0, 5);
  const formattedEnd = endTime.slice(0, 5);

  const resend = getResend();
  const fromEmail = getFromEmail();
  const promises: Promise<unknown>[] = [];

  // Email to professional
  promises.push(
    resend.emails.send({
      from: `CircleHood <${fromEmail}>`,
      to: professionalEmail,
      subject: `Novo agendamento: ${clientName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Novo agendamento recebido!</h2>
          <p>Você recebeu um novo agendamento:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666;">Cliente</td><td style="padding: 8px 0; font-weight: 600;">${clientName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Servico</td><td style="padding: 8px 0; font-weight: 600;">${serviceName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Data</td><td style="padding: 8px 0; font-weight: 600;">${formattedDate}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Horario</td><td style="padding: 8px 0; font-weight: 600;">${formattedStart} - ${formattedEnd}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Valor</td><td style="padding: 8px 0; font-weight: 600;">${formattedPrice}</td></tr>
          </table>
          <p style="margin-top: 24px; color: #666; font-size: 14px;">Acesse o dashboard para gerenciar seus agendamentos.</p>
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
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Agendamento confirmado!</h2>
            <p>Ola ${clientName}, seu agendamento foi confirmado:</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #666;">Servico</td><td style="padding: 8px 0; font-weight: 600;">${serviceName}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Data</td><td style="padding: 8px 0; font-weight: 600;">${formattedDate}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Horario</td><td style="padding: 8px 0; font-weight: 600;">${formattedStart} - ${formattedEnd}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Valor</td><td style="padding: 8px 0; font-weight: 600;">${formattedPrice}</td></tr>
            </table>
            <p style="margin-top: 24px; color: #666; font-size: 14px;">Em caso de duvidas, entre em contato com ${businessName}.</p>
          </div>
        `,
      })
    );
  }

  try {
    await Promise.allSettled(promises);
  } catch {
    // Email failures should not break the booking flow
    console.error('Failed to send booking emails');
  }
}
