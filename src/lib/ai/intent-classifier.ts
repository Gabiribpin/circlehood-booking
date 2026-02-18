export async function classifyIntent(message: string, language: string): Promise<string> {
  const messageLower = message.toLowerCase();

  // Palavras-chave por idioma
  const bookingKeywords = {
    pt: ['agendar', 'marcar', 'horário', 'horario', 'quero'],
    en: ['book', 'schedule', 'appointment', 'reserve'],
    ro: ['programare', 'rezervare'],
    ar: ['حجز', 'موعد'],
    es: ['agendar', 'reservar', 'cita']
  };

  const priceKeywords = {
    pt: ['preço', 'preco', 'valor', 'quanto custa'],
    en: ['price', 'cost', 'how much'],
    ro: ['preț', 'cost'],
    ar: ['سعر', 'كم'],
    es: ['precio', 'coste', 'cuánto']
  };

  // Verificar intenção de agendamento
  const langBooking = bookingKeywords[language as keyof typeof bookingKeywords] || bookingKeywords.en;
  if (langBooking.some(keyword => messageLower.includes(keyword))) {
    return 'booking';
  }

  // Verificar intenção de preço
  const langPrice = priceKeywords[language as keyof typeof priceKeywords] || priceKeywords.en;
  if (langPrice.some(keyword => messageLower.includes(keyword))) {
    return 'price_inquiry';
  }

  // Saudação
  if (['hi', 'hello', 'oi', 'olá', 'hola', 'bună'].some(w => messageLower.includes(w))) {
    return 'greeting';
  }

  return 'general_inquiry';
}
