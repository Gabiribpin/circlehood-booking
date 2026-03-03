import { logger } from '@/lib/logger';
// Templates multilíngues de notificações

export const NOTIFICATION_TEMPLATES = {
  booking_confirmation: {
    pt: {
      whatsapp: `✅ Agendamento Confirmado!

Olá {name},
Seu agendamento foi confirmado com sucesso:

📅 Data: {date}
⏰ Horário: {time}
✂️ Serviço: {service}
💰 Valor: €{price}
📍 Local: {location}

{reschedule_link}

Nos vemos lá! 💜
{professional_name}`,
      email_subject: 'Agendamento Confirmado - {professional_name}',
      email_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #667eea;">✅ Agendamento Confirmado!</h2>
  <p>Olá <strong>{name}</strong>,</p>
  <p>Seu agendamento foi confirmado com sucesso:</p>
  <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
    <p><strong>📅 Data:</strong> {date}</p>
    <p><strong>⏰ Horário:</strong> {time}</p>
    <p><strong>✂️ Serviço:</strong> {service}</p>
    <p><strong>💰 Valor:</strong> €{price}</p>
    <p><strong>📍 Local:</strong> {location}</p>
  </div>
  {reschedule_html}
  <p>Nos vemos lá! 💜</p>
  <p><strong>{professional_name}</strong></p>
</div>`,
    },
    en: {
      whatsapp: `✅ Booking Confirmed!

Hi {name},
Your booking has been confirmed successfully:

📅 Date: {date}
⏰ Time: {time}
✂️ Service: {service}
💰 Price: €{price}
📍 Location: {location}

{reschedule_link}

See you there! 💜
{professional_name}`,
      email_subject: 'Booking Confirmed - {professional_name}',
      email_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #667eea;">✅ Booking Confirmed!</h2>
  <p>Hi <strong>{name}</strong>,</p>
  <p>Your booking has been confirmed successfully:</p>
  <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
    <p><strong>📅 Date:</strong> {date}</p>
    <p><strong>⏰ Time:</strong> {time}</p>
    <p><strong>✂️ Service:</strong> {service}</p>
    <p><strong>💰 Price:</strong> €{price}</p>
    <p><strong>📍 Location:</strong> {location}</p>
  </div>
  {reschedule_html}
  <p>See you there! 💜</p>
  <p><strong>{professional_name}</strong></p>
</div>`,
    },
    es: {
      whatsapp: `✅ ¡Reserva Confirmada!

Hola {name},
Tu reserva ha sido confirmada con éxito:

📅 Fecha: {date}
⏰ Hora: {time}
✂️ Servicio: {service}
💰 Precio: €{price}
📍 Ubicación: {location}

{reschedule_link}

¡Nos vemos! 💜
{professional_name}`,
      email_subject: 'Reserva Confirmada - {professional_name}',
      email_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #667eea;">✅ ¡Reserva Confirmada!</h2>
  <p>Hola <strong>{name}</strong>,</p>
  <p>Tu reserva ha sido confirmada con éxito:</p>
  <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
    <p><strong>📅 Fecha:</strong> {date}</p>
    <p><strong>⏰ Hora:</strong> {time}</p>
    <p><strong>✂️ Servicio:</strong> {service}</p>
    <p><strong>💰 Precio:</strong> €{price}</p>
    <p><strong>📍 Ubicación:</strong> {location}</p>
  </div>
  {reschedule_html}
  <p>¡Nos vemos! 💜</p>
  <p><strong>{professional_name}</strong></p>
</div>`,
    },
  },

  waitlist_available: {
    pt: {
      whatsapp: `🎉 Vaga Disponível!

Olá {name}!

Ótimas notícias! Uma vaga ficou disponível:

📅 Data: {date}
⏰ Horário: {time}
✂️ Serviço: {service}

Você tem 24 horas para agendar:
{booking_link}

{professional_name}`,
    },
    en: {
      whatsapp: `🎉 Slot Available!

Hi {name}!

Great news! A slot just became available:

📅 Date: {date}
⏰ Time: {time}
✂️ Service: {service}

You have 24 hours to book:
{booking_link}

{professional_name}`,
    },
    es: {
      whatsapp: `🎉 ¡Lugar Disponible!

¡Hola {name}!

¡Buenas noticias! Un lugar está disponible:

📅 Fecha: {date}
⏰ Hora: {time}
✂️ Servicio: {service}

Tienes 24 horas para reservar:
{booking_link}

{professional_name}`,
    },
  },

  loyalty_reward_earned: {
    pt: {
      whatsapp: `🎁 Você Ganhou uma Recompensa!

Parabéns {name}! 🎉

Você completou 10 carimbos e ganhou:
🎁 {rewards_count} serviço(s) GRÁTIS!

Veja seu cartão de fidelidade:
{card_link}

{professional_name}`,
    },
    en: {
      whatsapp: `🎁 You Earned a Reward!

Congratulations {name}! 🎉

You completed 10 stamps and earned:
🎁 {rewards_count} FREE service(s)!

Check your loyalty card:
{card_link}

{professional_name}`,
    },
    es: {
      whatsapp: `🎁 ¡Ganaste una Recompensa!

¡Felicidades {name}! 🎉

Completaste 10 sellos y ganaste:
🎁 {rewards_count} servicio(s) ¡GRATIS!

Mira tu tarjeta de fidelidad:
{card_link}

{professional_name}`,
    },
  },
};

export function formatTemplate(
  type: keyof typeof NOTIFICATION_TEMPLATES,
  channel: 'whatsapp' | 'email_subject' | 'email_body',
  language: 'pt' | 'en' | 'es',
  data: Record<string, any>
): string {
  const template = (NOTIFICATION_TEMPLATES as any)[type]?.[language]?.[channel];

  if (!template) {
    logger.error(`Template not found: ${type}/${channel}/${language}`);
    return '';
  }

  let message = template;
  Object.keys(data).forEach((key) => {
    const value = data[key] || '';
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  });

  return message;
}

export function detectLanguageFromPhone(phone: string): 'pt' | 'en' | 'es' {
  if (phone.startsWith('+55')) return 'pt'; // Brasil
  if (phone.startsWith('+351')) return 'pt'; // Portugal
  if (phone.startsWith('+34')) return 'es'; // Espanha
  if (phone.startsWith('+52')) return 'es'; // México
  if (phone.startsWith('+54')) return 'es'; // Argentina
  return 'en'; // Default (Irlanda, Índia, etc)
}
