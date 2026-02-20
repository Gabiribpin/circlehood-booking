import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { classifyIntent } from './intent-classifier';
import { ConversationCache } from '@/lib/redis/conversation-cache';

// Tier 3 de fallback: in-memory Map (funciona dentro da mesma instância Vercel)
// Garante contexto mesmo quando Redis (tier 1) e Supabase (tier 2) falham
const memoryCache = new Map<string, Array<{ role: 'user' | 'assistant'; content: string; ts: number }>>();

// Converte "HH:MM" ou "HH:MM:SS" em minutos desde meia-noite
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Sugere primeiro slot disponível dentro do expediente real do profissional.
// Se date === hoje (Dublin), ignora horários que já passaram (+1h de margem).
// Retorna null se não houver slot disponível para este dia.
function suggestAlternative(
  date: string,
  existingBookings: Array<{ start_time: string; end_time?: string | null }>,
  durationMinutes: number,
  workStartTime: string, // ex: "09:00"
  workEndTime: string    // ex: "18:00"
): string | null {
  const workStartMins = timeToMinutes(workStartTime);
  const workEndMins = timeToMinutes(workEndTime);

  // Hora atual em Dublin
  const nowDublin = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Dublin' }));
  const todayStr = nowDublin.toISOString().split('T')[0];
  const isToday = date === todayStr;

  // Horário mínimo: se hoje, próxima hora cheia + 1h de margem; senão, início do expediente
  const minMinutes = isToday
    ? Math.ceil((nowDublin.getHours() * 60 + nowDublin.getMinutes() + 60) / 60) * 60
    : workStartMins;

  if (isToday) {
    console.log(`⏰ Hoje Dublin ${nowDublin.getHours()}:${String(nowDublin.getMinutes()).padStart(2, '0')} → mínimo ${Math.floor(minMinutes / 60)}:00 | expediente ${workStartTime}–${workEndTime}`);
  }

  // Iterar slots de 60 em 60 min dentro do expediente
  for (let slotMins = workStartMins; slotMins + durationMinutes <= workEndMins; slotMins += 60) {
    if (slotMins < minMinutes) continue;
    const slotEnd = slotMins + durationMinutes;
    const slot = `${String(Math.floor(slotMins / 60)).padStart(2, '0')}:${String(slotMins % 60).padStart(2, '0')}`;
    const hasConflict = existingBookings.some((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = b.end_time ? timeToMinutes(b.end_time) : bStart + 60;
      return slotMins < bEnd && slotEnd > bStart;
    });
    if (!hasConflict) return slot;
  }
  return null;
}

interface ConversationContext {
  userId: string;
  phone: string;
  conversationId: string;
  language: string;
  history: Array<{ role: 'user' | 'assistant', content: string }>;
  businessInfo: any;
}

export class AIBot {
  private anthropic: Anthropic;
  private supabase;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async processMessage(phone: string, message: string, businessId: string) {
    // 1. Buscar contexto (Redis → Supabase como fallback)
    const context = await this.getConversationContext(phone, businessId);

    // 2. Idioma padrão
    if (!context.language) {
      context.language = 'pt';
    }

    // 3. Classificar intenção
    const intent = await classifyIntent(message, context.language);

    // 4. Gerar resposta
    console.log('🤖 Chamando Anthropic para', phone, '| intent:', intent, '| history:', context.history.length);
    const response = await this.generateResponse(message, intent, context);
    console.log('✅ Anthropic respondeu para', phone);

    // 5. Salvar nos 3 tiers em paralelo
    const cacheKey = `${businessId}_${phone}`;

    // Tier 3 (memory) — síncrono, sempre funciona
    const cached = memoryCache.get(cacheKey) || [];
    cached.push(
      { role: 'user', content: message, ts: Date.now() },
      { role: 'assistant', content: response, ts: Date.now() + 1 },
    );
    memoryCache.set(cacheKey, cached.slice(-20));

    // Tier 1 (Redis) + Tier 2 (Supabase DB) — em paralelo, ambos aguardados
    await Promise.allSettled([
      ConversationCache.addMessages(cacheKey, [
        { role: 'user', content: message, timestamp: Date.now() },
        { role: 'assistant', content: response, timestamp: Date.now() + 1 },
      ]),
      this.saveToHistory(context.conversationId, context.phone, message, response),
    ]);

    return response;
  }

  private async generateResponse(
    message: string,
    intent: string,
    context: ConversationContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);
    const professionalId = context.businessInfo.professional_id;

    const tools = [
      {
        name: 'create_appointment',
        description: 'Cria um agendamento REAL no sistema. Use SOMENTE quando o cliente tiver confirmado: nome completo, serviço desejado, data específica e horário específico. NÃO use para verificar disponibilidade.',
        input_schema: {
          type: 'object' as const,
          properties: {
            customer_name: { type: 'string', description: 'Nome completo do cliente' },
            customer_phone: { type: 'string', description: 'Telefone do cliente (já disponível no contexto)' },
            service_name: { type: 'string', description: 'Nome do serviço (ex: "Corte", "Manicure", "Pézinho")' },
            date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
            time: { type: 'string', description: 'Horário no formato HH:MM' },
            service_location: { type: 'string', description: 'Local do atendimento: "in_salon" (no salão) ou "at_home" (a domicílio)' },
            customer_address: { type: 'string', description: 'Endereço do cliente — obrigatório quando service_location="at_home"' },
            notes: { type: 'string', description: 'Observações adicionais (opcional)' },
          },
          required: ['customer_name', 'customer_phone', 'service_name', 'date', 'time'],
        },
      },
    ];

    const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [
      ...context.history,
      { role: 'user', content: message },
    ];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CONTEXTO ANTHROPIC:');
    console.log('  history.length:', context.history.length);
    console.log('  isFirstMessage:', context.history.length === 0);
    console.log('  conversationId:', context.conversationId);
    console.log('  messages[últimas 2]:', messages.slice(-2).map(m => `${m.role}: ${String(m.content).substring(0, 60)}`));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const cachedSystem = [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }];

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: cachedSystem,
      tools,
      messages,
    });

    console.log(`💰 Cache: create=${(response.usage as any).cache_creation_input_tokens ?? 0} read=${(response.usage as any).cache_read_input_tokens ?? 0} input=${response.usage.input_tokens}`);

    // Se o Claude decidiu usar a tool create_appointment
    if (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(
        (c): c is { type: 'tool_use'; id: string; name: string; input: Record<string, any> } =>
          c.type === 'tool_use'
      );

      if (toolUseBlock && toolUseBlock.name === 'create_appointment') {
        console.log('🛠️ Tool use: create_appointment', JSON.stringify(toolUseBlock.input));

        const result = await this.createAppointment(
          toolUseBlock.input as any,
          professionalId
        );

        console.log('📅 createAppointment result:', JSON.stringify(result));

        // Segunda chamada com o resultado da tool (sistema já em cache)
        const followUp = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: cachedSystem,
          tools,
          messages: [
            ...messages,
            { role: 'assistant', content: response.content },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: JSON.stringify(result),
                },
              ],
            },
          ],
        });

        const textFollowUp = (followUp.content as any[]).find(c => c.type === 'text');
        return textFollowUp?.text ?? '';
      }
    }

    // Resposta de texto normal
    const textBlock = (response.content as any[]).find(c => c.type === 'text');
    return textBlock?.text ?? '';
  }

  private normalizeDate(dateStr: string): string {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const lower = dateStr.toLowerCase().trim();
    if (lower === 'hoje' || lower === 'today') return todayStr;
    if (lower === 'amanhã' || lower === 'amanha' || lower === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    // Se já está em formato YYYY-MM-DD, retorna como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Formato DD/MM/YYYY
    const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    // Fallback: hoje
    console.warn('createAppointment: data não reconhecida:', dateStr, '→ usando hoje');
    return todayStr;
  }

  private normalizeTime(timeStr: string): string {
    const t = timeStr.trim();
    // "18h" ou "18H"
    if (/^\d{1,2}[hH]$/.test(t)) return t.replace(/[hH]/, '').padStart(2, '0') + ':00';
    // "18h30" ou "18H30"
    const hm = t.match(/^(\d{1,2})[hH](\d{2})$/);
    if (hm) return `${hm[1].padStart(2,'0')}:${hm[2]}`;
    // "18:00" ou "18:00:00"
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return t.slice(0, 5).padStart(5, '0');
    // Fallback: retorna como está
    return t;
  }

  private async createAppointment(
    data: {
      customer_name: string;
      customer_phone: string;
      service_name: string;
      date: string;
      time: string;
      service_location?: string;
      customer_address?: string;
      notes?: string;
    },
    professionalId: string
  ): Promise<{ success: boolean; error?: string; message?: string; appointment_id?: string; service_name?: string; price?: number; date?: string; time?: string }> {
    try {
      // Normalizar data e hora antes de qualquer operação
      const bookingDate = this.normalizeDate(data.date);
      const bookingTime = this.normalizeTime(data.time);
      console.log(`📅 createAppointment: date="${data.date}"→"${bookingDate}" time="${data.time}"→"${bookingTime}" service="${data.service_name}" name="${data.customer_name}"`);

      // BUG #1 fix: rejeitar horários no passado (Dublin timezone)
      const now = new Date();
      const dublinNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Dublin' }));
      const dublinTodayStr = `${dublinNow.getFullYear()}-${String(dublinNow.getMonth() + 1).padStart(2, '0')}-${String(dublinNow.getDate()).padStart(2, '0')}`;
      const requestedDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
      const dublinNowDateTime = new Date(`${dublinTodayStr}T${String(dublinNow.getHours()).padStart(2, '0')}:${String(dublinNow.getMinutes()).padStart(2, '0')}:00`);

      if (requestedDateTime < dublinNowDateTime) {
        const diffMins = Math.ceil((dublinNowDateTime.getTime() - requestedDateTime.getTime()) / (1000 * 60));
        const nowLabel = `${String(dublinNow.getHours()).padStart(2, '0')}:${String(dublinNow.getMinutes()).padStart(2, '0')}`;
        console.log(`⛔ Horário no passado: solicitado ${bookingDate} ${bookingTime}, Dublin agora ${dublinTodayStr} ${nowLabel} (diff=${diffMins}min)`);
        if (diffMins <= 30) {
          return {
            success: false,
            error: 'past_time_close',
            message: `Esse horário acabou de passar (${diffMins} minuto${diffMins === 1 ? '' : 's'} atrás). Já são ${nowLabel} agora. Quer que eu verifique o próximo horário disponível?`,
          };
        }
        return {
          success: false,
          error: 'past_time',
          message: `Não posso agendar no passado! Você pediu ${bookingTime} mas já são ${nowLabel} agora. Qual horário você gostaria?`,
        };
      }

      // 1. Buscar serviço por nome (parcial)
      const { data: service, error: serviceError } = await this.supabase
        .from('services')
        .select('id, name, price, duration_minutes')
        .eq('professional_id', professionalId)
        .ilike('name', `%${data.service_name}%`)
        .limit(1)
        .maybeSingle();

      if (serviceError || !service) {
        console.error('createAppointment: serviço não encontrado:', data.service_name, serviceError);
        return { success: false, error: `Serviço "${data.service_name}" não encontrado` };
      }

      // 2. Verificar agendamentos futuros do mesmo cliente (duplicatas)
      const todayISO = new Date().toISOString().split('T')[0];
      const { data: futureBookings } = await this.supabase
        .from('bookings')
        .select('id, booking_date, start_time, service_id, services(name)')
        .eq('professional_id', professionalId)
        .eq('client_phone', data.customer_phone)
        .gte('booking_date', todayISO)
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .order('booking_date', { ascending: true });

      if (futureBookings && futureBookings.length > 0) {
        console.log(`⚠️ Cliente já tem ${futureBookings.length} agendamento(s) futuro(s)`);

        // Mesmo dia (qualquer serviço)
        const sameDay = futureBookings.find((b) => b.booking_date === bookingDate);
        if (sameDay) {
          const sameDayTime = sameDay.start_time.slice(0, 5);
          const sameDayService = (sameDay as any).services?.name ?? 'serviço';
          const sameDayDateLabel = new Date(sameDay.booking_date + 'T12:00:00Z')
            .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
          console.log(`🚨 Duplicata mesmo dia: ${sameDay.booking_date} ${sameDayTime} ${sameDayService}`);
          return {
            success: false,
            error: 'duplicate_same_day',
            message: `Você já tem um agendamento para ${sameDayDateLabel} às ${sameDayTime} (${sameDayService}). Quer remarcar para ${bookingTime} ou é um serviço diferente?`,
          };
        }

        // Mesmo serviço em até 3 dias
        const reqDate = new Date(bookingDate + 'T12:00:00Z').getTime();
        const nearby = futureBookings.find((b) => {
          const diffDays = Math.abs(new Date(b.booking_date + 'T12:00:00Z').getTime() - reqDate) / 86400000;
          return diffDays <= 3 && b.service_id === service.id;
        });
        if (nearby) {
          const nearbyTime = nearby.start_time.slice(0, 5);
          const nearbyLabel = new Date(nearby.booking_date + 'T12:00:00Z')
            .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
          const requestedDateLabel = new Date(bookingDate + 'T12:00:00Z')
            .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
          console.log(`⚠️ Mesmo serviço em dias próximos: ${nearby.booking_date} ${nearbyTime}`);
          return {
            success: false,
            error: 'duplicate_nearby',
            message: `Você já tem ${service.name} marcado para ${nearbyLabel} às ${nearbyTime}. Quer remarcar para ${requestedDateLabel} às ${bookingTime}, ou confirma os dois agendamentos?`,
          };
        }
      }

      // 3. Validar dia e horário dentro do expediente
      const bookingDayInt = new Date(bookingDate + 'T12:00:00Z').getUTCDay();
      const { data: dayWH } = await this.supabase
        .from('working_hours')
        .select('start_time, end_time')
        .eq('professional_id', professionalId)
        .eq('day_of_week', bookingDayInt)
        .eq('is_available', true)
        .maybeSingle();

      if (!dayWH) {
        console.log(`🚫 Profissional não atende dia_int=${bookingDayInt} (${bookingDate})`);
        return {
          success: false,
          error: 'day_unavailable',
          message: `Desculpe, não atendo nesse dia. Qual outro dia funciona para você?`,
        };
      }

      const duration = service.duration_minutes ?? 60;
      const reqStartMins = timeToMinutes(bookingTime);
      const workStartMins = timeToMinutes(dayWH.start_time);
      const workEndMins = timeToMinutes(dayWH.end_time);
      if (reqStartMins < workStartMins || reqStartMins + duration > workEndMins) {
        console.log(`🚫 Horário fora do expediente: ${bookingTime} (expediente ${dayWH.start_time}–${dayWH.end_time})`);
        return {
          success: false,
          error: 'outside_hours',
          message: `Desculpe, atendo das ${dayWH.start_time.slice(0, 5)} às ${dayWH.end_time.slice(0, 5)}. Quer agendar dentro desse horário?`,
        };
      }

      // 4. Calcular horário de término
      const [hours, minutes] = bookingTime.split(':').map(Number);
      const endTotalMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(endTotalMinutes / 60) % 24;
      const endMins = endTotalMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;

      // 5. Verificar conflitos de horário
      const { data: existingBookings } = await this.supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('professional_id', professionalId)
        .eq('booking_date', bookingDate)
        .neq('status', 'cancelled')
        .neq('status', 'completed');

      if (existingBookings && existingBookings.length > 0) {
        const reqStart = timeToMinutes(bookingTime);
        const reqEnd = reqStart + duration;
        for (const b of existingBookings) {
          const bStart = timeToMinutes(b.start_time);
          const bEnd = b.end_time ? timeToMinutes(b.end_time) : bStart + 60;
          if (reqStart < bEnd && reqEnd > bStart) {
            const occupied = b.start_time.slice(0, 5);
            console.log(`❌ Conflito: solicitado ${bookingTime}–${endTime.slice(0, 5)}, existente ${occupied}–${b.end_time?.slice(0, 5) ?? '?'}`);

            // day_of_week é INT: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
            const todayDayInt = new Date(bookingDate + 'T12:00:00Z').getUTCDay();

            // Buscar expediente de hoje
            const { data: todayWH } = await this.supabase
              .from('working_hours')
              .select('start_time, end_time')
              .eq('professional_id', professionalId)
              .eq('day_of_week', todayDayInt)
              .eq('is_available', true)
              .maybeSingle();

            console.log(`🗓️ Working hours hoje (day_int=${todayDayInt}):`, todayWH ? `${todayWH.start_time}–${todayWH.end_time}` : 'não atende');

            const todaySlot = todayWH
              ? suggestAlternative(bookingDate, existingBookings, duration, todayWH.start_time, todayWH.end_time)
              : null;

            if (todaySlot) {
              return {
                success: false,
                error: 'unavailable',
                message: `Desculpe, esse horário não está disponível. Que tal às ${todaySlot} ainda hoje?`,
              };
            }

            // Sem slot hoje → tentar amanhã
            const tomorrowDate = new Date(bookingDate + 'T12:00:00Z');
            tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
            const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
            const tomorrowDayInt = tomorrowDate.getUTCDay();

            const [{ data: tomorrowWH }, { data: tomorrowBookings }] = await Promise.all([
              this.supabase
                .from('working_hours')
                .select('start_time, end_time')
                .eq('professional_id', professionalId)
                .eq('day_of_week', tomorrowDayInt)
                .eq('is_available', true)
                .maybeSingle(),
              this.supabase
                .from('bookings')
                .select('start_time, end_time')
                .eq('professional_id', professionalId)
                .eq('booking_date', tomorrowStr)
                .neq('status', 'cancelled')
                .neq('status', 'completed'),
            ]);

            console.log(`🗓️ Working hours amanhã (day_int=${tomorrowDayInt}, data=${tomorrowStr}):`, tomorrowWH ? `${tomorrowWH.start_time}–${tomorrowWH.end_time}` : 'não atende');

            if (!tomorrowWH) {
              return {
                success: false,
                error: 'unavailable',
                message: `Desculpe, não tenho disponibilidade nesse horário e amanhã não atendo. Podemos agendar para outro dia?`,
              };
            }

            const tomorrowSlot = suggestAlternative(tomorrowStr, tomorrowBookings ?? [], duration, tomorrowWH.start_time, tomorrowWH.end_time) ?? tomorrowWH.start_time.slice(0, 5);
            const tomorrowLabel = tomorrowDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

            return {
              success: false,
              error: 'unavailable',
              message: `Desculpe, não tenho disponibilidade nesse horário e não tenho mais vagas hoje. Que tal ${tomorrowLabel} às ${tomorrowSlot}?`,
            };
          }
        }
      }

      // 6. Inserir agendamento na tabela bookings
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .insert({
          professional_id: professionalId,
          service_id: service.id,
          booking_date: bookingDate,
          start_time: `${bookingTime}:00`,
          end_time: endTime,
          client_name: data.customer_name,
          client_phone: data.customer_phone,
          notes: data.notes || 'Agendado via WhatsApp Bot',
          status: 'confirmed',
          service_location: data.service_location || 'in_salon',
          customer_address: data.customer_address || null,
        })
        .select('id')
        .single();

      if (bookingError || !booking) {
        console.error('createAppointment: erro ao inserir booking:', JSON.stringify(bookingError));
        console.error('createAppointment: dados enviados:', { bookingDate, bookingTime, professionalId, serviceId: service.id });
        return { success: false, error: bookingError?.message ?? 'Erro ao criar agendamento' };
      }

      console.log('✅ Agendamento criado:', booking.id, '| serviço:', service.name, '| data:', data.date, data.time);
      return {
        success: true,
        appointment_id: booking.id,
        service_name: service.name,
        price: service.price,
        date: data.date,
        time: data.time,
      };

    } catch (err) {
      console.error('createAppointment: erro inesperado:', err);
      return { success: false, error: 'Erro inesperado ao criar agendamento' };
    }
  }

  private getPersonalityInstructions(personality: string): string {
    switch (personality) {
      case 'professional':
        return 'Seja profissional, formal e direto ao ponto. SEM emojis. Tom corporativo e respeitoso.';
      case 'casual':
        return 'Seja bem informal e descontraído. Use gírias e MUITOS emojis. Tom de amigo próximo.';
      case 'friendly':
      default:
        return 'Seja amigável, caloroso e acolhedor. Use emojis moderadamente. Tom próximo mas respeitoso.';
    }
  }

  private buildSystemPrompt(context: ConversationContext): string {
    const { businessInfo, phone, history } = context;
    const botConfig = businessInfo.botConfig;

    const botName = botConfig?.bot_name || businessInfo.business_name;
    const personality = botConfig?.bot_personality ?? 'friendly';
    const greetingMsg = botConfig?.greeting_message ?? '';
    const unavailableMsg = botConfig?.unavailable_message ?? '';
    const confirmationMsg = botConfig?.confirmation_message ?? '';
    const autoBook = botConfig?.auto_book_if_available ?? true;
    const alwaysConfirm = botConfig?.always_confirm_booking ?? false;
    const askAdditional = botConfig?.ask_for_additional_info ?? false;

    const isFirstMessage = history.length === 0;

    const conversationHistory = history.length > 0
      ? history.map(m => `${m.role === 'user' ? 'Cliente' : 'Você'}: ${m.content}`).join('\n')
      : '(Primeira mensagem desta conversa)';

    console.log(`📝 Prompt | isFirstMessage=${isFirstMessage} | historyLen=${history.length} | bot="${botName}"`);

    // Se custom_system_prompt preenchido → usar com substituição de variáveis
    if (botConfig?.custom_system_prompt) {
      const vars: Record<string, string> = {
        '{business_name}': businessInfo.business_name,
        '{bot_name}': botName,
        '{phone}': phone,
        '{services}': this.formatServices(businessInfo.services),
        '{schedule}': this.formatSchedule(businessInfo.schedule),
        '{location}': businessInfo.location,
        '{conversation_history}': conversationHistory,
      };
      let prompt = botConfig.custom_system_prompt;
      for (const [key, value] of Object.entries(vars)) {
        prompt = prompt.split(key).join(value);
      }
      return prompt;
    }

    return `# IDENTIDADE
Você é ${botName} (${businessInfo.business_name}). Telefone do cliente: ${phone} — nunca peça.
Tom: ${this.getPersonalityInstructions(personality)}
Responda SEMPRE no idioma do cliente.

# APRESENTAÇÃO
${isFirstMessage
      ? greetingMsg
        ? `Primeira mensagem: use exatamente "${greetingMsg}"`
        : `Apresente-se: "Olá! Sou ${botName} do ${businessInfo.business_name}. Como posso ajudar?"`
      : `NÃO se apresente. Continue a conversa diretamente. Se souber o nome do cliente, use-o.`}

# HISTÓRICO
${conversationHistory}

# REGRAS DE CONTEXTO
- Nunca pergunte algo já respondido no histórico (nome, serviço, data, horário)
- Use informações do histórico diretamente

# AGENDAMENTO
Para agendar: nome, serviço, data, horário. Pergunte apenas o que falta.
${autoBook ? 'Com todos os dados → chame create_appointment imediatamente.' : 'Com todos os dados → peça confirmação, então chame create_appointment.'}
${alwaysConfirm ? 'SEMPRE confirme com o cliente antes de criar.' : ''}
${askAdditional ? 'Pergunte preferências/observações.' : ''}
- Serviço [A domicílio] ou [Salão ou domicílio]: colete endereço do cliente antes.
- Confirme "Agendado!" APENAS se create_appointment retornar success: true.
- Em caso de erro técnico: "Houve um problema. Por favor, entre em contato."
- NUNCA diga "vou verificar disponibilidade" — a tool faz isso automaticamente.

# ERROS DA TOOL create_appointment
- past_time / past_time_close → repasse 'message', pergunte outro horário
- day_unavailable → repasse 'message', pergunte outro dia
- outside_hours → repasse 'message', pergunte horário dentro do expediente
- unavailable → horário ocupado, sugira alternativo do campo 'message'
- duplicate_same_day → repasse 'message', aguarde: "remarcar" ou "é outro serviço"
  - "remarcar": crie com novo horário; "outro serviço": colete serviço e crie
- duplicate_nearby → repasse 'message', aguarde: "remarcar" ou "confirmar dois"
  - "remarcar": confirme o novo; "confirmar dois": chame create_appointment normalmente
- Se cliente disser que agendamento foi cancelado: ACREDITE, ofereça reagendar diretamente.

# DATA E HORA
Hoje: ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Dublin' })})
"hoje" = ${new Date().toISOString().split('T')[0]} | "amanhã" = dia seguinte
Formato date: YYYY-MM-DD | Formato time: HH:MM

# NEGÓCIO
${businessInfo.business_name}${businessInfo.description ? ` — ${businessInfo.description}` : ''}
Local: ${businessInfo.location}

Serviços:
${this.formatServices(businessInfo.services)}

Horário:
${this.formatSchedule(businessInfo.schedule)}
${businessInfo.ai_instructions ? `\nInstruções: ${businessInfo.ai_instructions}` : ''}
${unavailableMsg ? `\nIndisponível: ${unavailableMsg}` : ''}

# CONFIRMAÇÃO DE AGENDAMENTO
${confirmationMsg || `Agendado [Nome]! ✅\n[Data] [Hora] - [Serviço] €[Preço]\nNos vemos em breve! 😊`}

# PROIBIDO
- Apresentar-se mais de uma vez
- Perguntar o que já foi dito
- Confirmar agendamento sem chamar a tool
- Pedir telefone (já temos: ${phone})
`;
  }

  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      'pt': 'português brasileiro',
      'en': 'English',
      'ro': 'română',
      'ar': 'العربية',
      'es': 'español'
    };
    return languages[code] || 'English';
  }

  private formatServices(services: any[]): string {
    return services.map(s => {
      const location = s.service_location === 'at_home' ? ' [A domicílio]'
        : s.service_location === 'both' ? ' [Salão ou domicílio]'
        : '';
      return `- ${s.name}: €${s.price}${s.duration_minutes ? ` (${s.duration_minutes}min)` : ''}${location}`;
    }).join('\n');
  }

  private formatSchedule(schedule: any): string {
    // Formatar horário de funcionamento
    return Object.entries(schedule)
      .map(([day, hours]: [string, any]) =>
        `${day}: ${hours.start} - ${hours.end}`
      )
      .join('\n');
  }

  private async getConversationContext(
    phone: string,
    businessId: string
  ): Promise<ConversationContext> {
    // 1. Buscar ou criar conversa
    const { data: conversation, error: convError } = await this.supabase
      .from('whatsapp_conversations')
      .upsert(
        { user_id: businessId, customer_phone: phone },
        { onConflict: 'user_id,customer_phone', ignoreDuplicates: false }
      )
      .select('id, language')
      .single();

    if (convError || !conversation) {
      console.error('Error fetching/creating conversation:', convError);
      return { userId: phone, phone, conversationId: '', language: '', history: [], businessInfo: {} };
    }

    // 2. Histórico — 3 tiers: Redis → Supabase → In-memory Map
    const cacheKey = `${businessId}_${phone}`;
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let historySource = 'none';

    // TIER 1: Redis (mais rápido, persiste entre instâncias)
    const redisHistory = await ConversationCache.getHistory(cacheKey);
    if (redisHistory.length > 0) {
      history = redisHistory.map(m => ({ role: m.role, content: m.content }));
      historySource = 'redis';
    }

    // TIER 2: Supabase DB (fallback persistente)
    if (history.length === 0) {
      const { data: messages } = await this.supabase
        .from('whatsapp_messages')
        .select('direction, content, sent_at')
        .eq('conversation_id', conversation.id)
        .order('sent_at', { ascending: false })
        .limit(20);

      if (messages && messages.length > 0) {
        history = messages
          .reverse()
          .map((m) => ({
            role: m.direction === 'inbound' ? 'user' : 'assistant' as 'user' | 'assistant',
            content: m.content,
          }));
        historySource = 'supabase';
        // Popular Redis com dados do banco para próximas chamadas
        ConversationCache.addMessages(
          cacheKey,
          history.map((m, i) => ({ ...m, timestamp: Date.now() - (history.length - i) * 1000 }))
        ).catch(() => {});
      }
    }

    // TIER 3: In-memory Map (fallback local — mesma instância Vercel)
    if (history.length === 0) {
      const cached = memoryCache.get(cacheKey) || [];
      const fresh = cached.filter(m => Date.now() - m.ts < 24 * 60 * 60 * 1000);
      if (fresh.length > 0) {
        history = fresh.map(m => ({ role: m.role, content: m.content }));
        historySource = 'memory';
      }
    }

    // OPT 3: limitar histórico a 10 mensagens para reduzir tokens
    const totalHistory = history.length;
    history = history.slice(-10);
    console.log(`📊 Histórico: ${history.length}/${totalHistory} msgs | source=${historySource} | conversationId=${conversation.id}`);

    // 3. Buscar info do negócio (professional + services + working_hours + botConfig + ai_instructions)
    const [
      { data: professional },
      { data: botConfig },
      { data: aiInstructions },
    ] = await Promise.all([
      this.supabase
        .from('professionals')
        .select('id, business_name, bio, city')
        .eq('user_id', businessId)
        .single(),
      this.supabase
        .from('bot_config')
        .select('*')
        .eq('user_id', businessId)
        .maybeSingle(),
      this.supabase
        .from('ai_instructions')
        .select('instructions')
        .eq('user_id', businessId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const [{ data: services }, { data: workingHours }] = await Promise.all([
      this.supabase
        .from('services')
        .select('name, price, duration_minutes, service_location')
        .eq('professional_id', professional?.id ?? '')
        .eq('is_active', true),
      this.supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time')
        .eq('professional_id', professional?.id ?? '')
        .eq('is_available', true),
    ]);

    const schedule = (workingHours ?? []).reduce(
      (acc: Record<string, { start: string; end: string }>, wh) => {
        acc[wh.day_of_week] = { start: wh.start_time, end: wh.end_time };
        return acc;
      },
      {}
    );

    // Log explícito para diagnóstico no Vercel
    console.log('🤖 Bot config loaded:', botConfig
      ? JSON.stringify({ bot_name: botConfig.bot_name, personality: botConfig.bot_personality, has_greeting: !!botConfig.greeting_message, auto_book: botConfig.auto_book_if_available })
      : 'NULL — nenhuma configuração encontrada para user_id=' + businessId
    );

    return {
      userId: phone,
      phone,
      conversationId: conversation.id,
      language: conversation.language ?? '',
      history,
      businessInfo: {
        professional_id: professional?.id ?? '',
        business_name: professional?.business_name ?? '',
        description: professional?.bio ?? '',
        services: services ?? [],
        schedule,
        location: professional?.city ?? '',
        ai_instructions: aiInstructions?.instructions ?? '',
        botConfig: botConfig ?? null,
      },
    };
  }

  private async saveToHistory(
    conversationId: string,
    phone: string,
    userMessage: string,
    botResponse: string
  ) {
    console.log('💾 saveToHistory iniciado | conversationId:', conversationId);
    if (!conversationId) {
      console.error('saveToHistory: conversationId vazio, abortando');
      return;
    }

    const now = new Date().toISOString();
    const twoMsLater = new Date(Date.now() + 2).toISOString();

    // Inserir mensagem do cliente (inbound) e resposta do bot (outbound)
    const { error: msgError } = await this.supabase
      .from('whatsapp_messages')
      .insert([
        {
          conversation_id: conversationId,
          direction: 'inbound',
          content: userMessage,
          recipient_phone: 'bot',
          message_type: 'text',
          message_content: userMessage,
          status: 'received',
          sent_at: now,
        },
        {
          conversation_id: conversationId,
          direction: 'outbound',
          content: botResponse,
          recipient_phone: phone,
          message_type: 'text',
          message_content: botResponse,
          status: 'sent',
          sent_at: twoMsLater,
        },
      ]);

    if (msgError) {
      console.error('saveToHistory: error inserting messages', msgError);
      return;
    }

    console.log('✅ saveToHistory: mensagens salvas para conversa', conversationId);

    await this.supabase
      .from('whatsapp_conversations')
      .update({ last_message_at: twoMsLater })
      .eq('id', conversationId);
  }
}
