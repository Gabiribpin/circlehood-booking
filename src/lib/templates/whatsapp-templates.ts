/**
 * WhatsApp Message Templates
 * Templates multilíngues para campanhas de marketing
 */

export interface TemplateVariables {
  nome?: string;
  data?: string;
  hora?: string;
  servico?: string;
  preco?: string;
  preco_antigo?: string;
  endereco?: string;
  link?: string;
  data_limite?: string;
}

export type TemplateType = 'confirmation' | 'reminder' | 'promotion' | 'followup' | 'zone_notification';
export type Language = 'pt' | 'en' | 'es' | 'ar' | 'hi';

/**
 * Templates de mensagens por tipo e idioma
 */
export const WHATSAPP_TEMPLATES: Record<TemplateType, Record<Language, string>> = {
  confirmation: {
    pt: `Oi {nome}! Tudo bem?
Confirmando seu agendamento:
🗓️ {data} às {hora}
✂️ Serviço: {servico}
📍 Local: {endereco}

Nos vemos lá! 💜`,

    en: `Hi {nome}!
Confirming your appointment:
🗓️ {data} at {hora}
✂️ Service: {servico}
📍 Location: {endereco}

See you there! 💜`,

    es: `¡Hola {nome}!
Confirmando tu cita:
🗓️ {data} a las {hora}
✂️ Servicio: {servico}
📍 Ubicación: {endereco}

¡Nos vemos! 💜`,

    ar: `مرحبا {nome}!
تأكيد موعدك:
🗓️ {data} في {hora}
✂️ الخدمة: {servico}
📍 الموقع: {endereco}

أراك هناك! 💜`,

    hi: `नमस्ते {nome}!
आपकी अपॉइंटमेंट की पुष्टि:
🗓️ {data} को {hora} बजे
✂️ सेवा: {servico}
📍 स्थान: {endereco}

वहां मिलते हैं! 💜`,
  },

  reminder: {
    pt: `Oi {nome}!
Lembrando que você tem agendamento amanhã:
🗓️ {data} às {hora}
✂️ {servico}
📍 {endereco}

Te espero lá! 😊`,

    en: `Hi {nome}!
Reminder: You have an appointment tomorrow:
🗓️ {data} at {hora}
✂️ {servico}
📍 {endereco}

See you! 😊`,

    es: `¡Hola {nome}!
Recordatorio: Tienes cita mañana:
🗓️ {data} a las {hora}
✂️ {servico}
📍 {endereco}

¡Te espero! 😊`,

    ar: `مرحبا {nome}!
تذكير: لديك موعد غدًا:
🗓️ {data} في {hora}
✂️ {servico}
📍 {endereco}

أراك! 😊`,

    hi: `नमस्ते {nome}!
याद दिलाना: कल आपकी अपॉइंटमेंट है:
🗓️ {data} को {hora} बजे
✂️ {servico}
📍 {endereco}

मिलते हैं! 😊`,
  },

  promotion: {
    pt: `Oi {nome}! 🎉
Promoção especial pra você!

💇‍♀️ {servico}: €{preco}
~~€{preco_antigo}~~

Válido até {data_limite}
Agende já: {link}`,

    en: `Hi {nome}! 🎉
Special offer for you!

💇‍♀️ {servico}: €{preco}
~~€{preco_antigo}~~

Valid until {data_limite}
Book now: {link}`,

    es: `¡Hola {nome}! 🎉
¡Oferta especial para ti!

💇‍♀️ {servico}: €{preco}
~~€{preco_antigo}~~

Válido hasta {data_limite}
Reserva ya: {link}`,

    ar: `مرحبا {nome}! 🎉
عرض خاص لك!

💇‍♀️ {servico}: €{preco}
~~€{preco_antigo}~~

صالح حتى {data_limite}
احجز الآن: {link}`,

    hi: `नमस्ते {nome}! 🎉
आपके लिए विशेष ऑफर!

💇‍♀️ {servico}: €{preco}
~~€{preco_antigo}~~

{data_limite} तक वैध
अभी बुक करें: {link}`,
  },

  followup: {
    pt: `Oi {nome}!
Faz tempo que não nos vemos 😊

Sentiu falta? Que tal agendar essa semana?
Temos horários disponíveis!

Agende aqui: {link}`,

    en: `Hi {nome}!
It's been a while since we've seen each other 😊

Miss us? How about booking this week?
We have slots available!

Book here: {link}`,

    es: `¡Hola {nome}!
Hace tiempo que no nos vemos 😊

¿Nos extrañas? ¿Qué tal reservar esta semana?
¡Tenemos horarios disponibles!

Reserva aquí: {link}`,

    ar: `مرحبا {nome}!
لقد مر وقت طويل منذ أن رأيناك 😊

هل تفتقدنا؟ ما رأيك في الحجز هذا الأسبوع؟
لدينا مواعيد متاحة!

احجز هنا: {link}`,

    hi: `नमस्ते {nome}!
हमें देखे काफी समय हो गया 😊

हमें याद किया? इस हफ्ते बुकिंग कैसी रहेगी?
हमारे पास स्लॉट उपलब्ध हैं!

यहां बुक करें: {link}`,
  },

  zone_notification: {
    pt: `Oi {nome}!
Na {data} vou atender na zona {zona}! 📍

Quer aproveitar e agendar?
{servico} disponível

Agende: {link}`,

    en: `Hi {nome}!
On {data} I'll be working in {zona} area! 📍

Want to book an appointment?
{servico} available

Book: {link}`,

    es: `¡Hola {nome}!
¡El {data} estaré trabajando en la zona {zona}! 📍

¿Quieres aprovechar y reservar?
{servico} disponible

Reserva: {link}`,

    ar: `مرحبا {nome}!
في {data} سأعمل في منطقة {zona}! 📍

هل تريد الحجز؟
{servico} متاح

احجز: {link}`,

    hi: `नमस्ते {nome}!
{data} को मैं {zona} क्षेत्र में काम करूंगा! 📍

अपॉइंटमेंट बुक करना चाहते हैं?
{servico} उपलब्ध

बुक करें: {link}`,
  },
};

/**
 * Substitui variáveis no template
 */
export function replaceVariables(template: string, variables: TemplateVariables): string {
  let result = template;

  Object.entries(variables).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
  });

  return result;
}

/**
 * Retorna template por tipo e idioma
 */
export function getTemplate(type: TemplateType, language: Language): string {
  return WHATSAPP_TEMPLATES[type][language] || WHATSAPP_TEMPLATES[type].en;
}

/**
 * Gera mensagem completa
 */
export function generateMessage(
  type: TemplateType,
  language: Language,
  variables: TemplateVariables
): string {
  const template = getTemplate(type, language);
  return replaceVariables(template, variables);
}

/**
 * Lista de tipos de template disponíveis
 */
export const TEMPLATE_TYPES = [
  { value: 'confirmation', label: 'Confirmação de Agendamento' },
  { value: 'reminder', label: 'Lembrete' },
  { value: 'promotion', label: 'Promoção' },
  { value: 'followup', label: 'Follow-up (Re-engajamento)' },
  { value: 'zone_notification', label: 'Notificação por Zona' },
] as const;

/**
 * Gera link do WhatsApp Web
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
