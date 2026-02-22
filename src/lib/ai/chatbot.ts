import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { classifyIntent } from './intent-classifier';
import { ConversationCache } from '@/lib/redis/conversation-cache';
import { timeToMinutes, suggestAlternative, normalizeDate, normalizeTime } from './booking-utils';

// Tier 3 de fallback: in-memory Map (funciona dentro da mesma instância Vercel)
// Garante contexto mesmo quando Redis (tier 1) e Supabase (tier 2) falham
// O conversationId é armazenado junto para detectar quando a conversa foi recriada
// (ex: limpeza de testes), evitando servir histórico stale de uma sessão anterior.
const memoryCache = new Map<string, {
  conversationId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; ts: number }>;
}>();

/** Limpa a camada in-memory para uma chave específica (usado em testes e pelo endpoint admin). */
export function clearMemoryCache(cacheKey: string): boolean {
  return memoryCache.delete(cacheKey);
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

    // 3. Saudação direta na PRIMEIRA mensagem (bypass Claude — garante texto exato)
    //
    // ATENÇÃO: isFirstMessage só é verdadeiro se AMBAS as condições se verificam:
    //  a) histórico vazio (nenhuma troca anterior)
    //  b) mensagem parece uma saudação ("oi", "olá", "hello"…)
    //
    // Proteção contra falsos-positivos quando Redis/Supabase falham transitoriamente
    // (cold start do Vercel): sem essa guarda, uma mensagem de agendamento como
    // "quero cortar cabelo no domingo" receberia uma saudação em vez de ser processada.
    const looksLikeGreeting = /^[\s]*?(oi\b|olá|ola\b|oii|hello\b|hi\b|hey\b|bom dia|boa tarde|boa noite|tudo bem|e aí|good morning|good afternoon)/i.test(message.trim());
    const isFirstMessage = context.history.length === 0 && looksLikeGreeting;
    if (isFirstMessage) {
      const botConfig = context.businessInfo.botConfig;
      const botName = botConfig?.bot_name ?? null;
      const greetingMsg = botConfig?.greeting_message ?? '';
      const businessName = context.businessInfo.business_name ?? '';
      const isProfessional = botConfig?.bot_personality === 'professional';
      const helpSuffix = isProfessional ? 'Como posso ajudar?' : 'Como posso ajudar? 😊';

      let greeting: string | null = null;
      if (botName && greetingMsg) {
        greeting = `${greetingMsg}\nSou ${botName}! ${helpSuffix}`;
      } else if (botName) {
        greeting = `Olá! Sou ${botName}, assistente do ${businessName}. ${helpSuffix}`;
      } else if (greetingMsg) {
        greeting = greetingMsg;
      }

      if (greeting) {
        const cacheKey = `${businessId}_${phone}`;
        // Lock distribuído: evita race condition quando mensagens chegam simultaneamente
        const lockAcquired = await ConversationCache.acquireGreetingLock(cacheKey);
        if (!lockAcquired) {
          console.log(`🔒 Greeting já enviado por outro processo — processando como mensagem normal`);
          // Aguarda brevemente para o histórico ser salvo pelo processo que ganhou o lock
          await new Promise(r => setTimeout(r, 500));
          // Continua para processamento normal (Claude responde às perguntas)
        } else {
          console.log(`👋 Saudação direta (bypass Claude): "${greeting}"`);
          const entry = memoryCache.get(cacheKey) || { conversationId: context.conversationId, messages: [] };
          entry.messages.push(
            { role: 'user', content: message, ts: Date.now() },
            { role: 'assistant', content: greeting, ts: Date.now() + 1 },
          );
          memoryCache.set(cacheKey, { conversationId: context.conversationId, messages: entry.messages.slice(-20) });
          await Promise.allSettled([
            ConversationCache.addMessages(cacheKey, [
              { role: 'user', content: message, timestamp: Date.now() },
              { role: 'assistant', content: greeting, timestamp: Date.now() + 1 },
            ]),
            this.saveToHistory(context.conversationId, context.phone, message, greeting),
          ]);
          return greeting;
        }
      }
    }

    // 4. Classificar intenção
    const intent = await classifyIntent(message, context.language);

    // 5. Gerar resposta
    console.log('🤖 Chamando Anthropic para', phone, '| intent:', intent, '| history:', context.history.length);
    const response = await this.generateResponse(message, intent, context);
    console.log('✅ Anthropic respondeu para', phone);

    // 5. Salvar nos 3 tiers em paralelo
    const cacheKey = `${businessId}_${phone}`;

    // Tier 3 (memory) — síncrono, sempre funciona
    const entry = memoryCache.get(cacheKey) || { conversationId: context.conversationId, messages: [] };
    entry.messages.push(
      { role: 'user', content: message, ts: Date.now() },
      { role: 'assistant', content: response, ts: Date.now() + 1 },
    );
    memoryCache.set(cacheKey, { conversationId: context.conversationId, messages: entry.messages.slice(-20) });

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
    const systemPrompt = this.buildSystemPrompt(context, message);
    const professionalId = context.businessInfo.professional_id;

    const tools = [
      {
        name: 'create_appointment',
        description: 'Cria um agendamento REAL no banco de dados E verifica disponibilidade automaticamente. Use quando cliente fornecer nome, serviço, data e horário. Retorna success=true se disponível (agendamento criado) ou success=false com mensagem de erro/alternativa se indisponível. SEMPRE aguarde o retorno antes de confirmar ao cliente.',
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
      {
        name: 'get_my_appointments',
        description: 'Busca agendamentos futuros REAIS do cliente no banco de dados. Use SEMPRE que: (1) cliente perguntar sobre agendamentos ("tenho horário?", "quando estou marcada?"), (2) antes de cancelar agendamento (para obter booking_id), (3) quando houver dúvida se cliente tem agendamento. Retorna lista vazia se cliente não tiver agendamentos futuros. NUNCA liste agendamentos sem chamar esta tool.',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'cancel_appointment',
        description: 'Cancela um agendamento existente. FLUXO OBRIGATÓRIO: (1) Chame get_my_appointments para obter booking_id, (2) ANTES de cancelar, tente RETENÇÃO: ofereça reagendar para outro horário, (3) APENAS se cliente confirmar cancelamento → chame esta tool com booking_id. Retorna success=true se cancelado.',
        input_schema: {
          type: 'object' as const,
          properties: {
            booking_id: { type: 'string', description: 'ID UUID do agendamento obtido via get_my_appointments' },
          },
          required: ['booking_id'],
        },
      },
      {
        name: 'reschedule_appointment',
        description: `Reagenda um agendamento existente para uma nova data/hora de forma atômica: cancela o antigo e cria o novo em sequência com rollback automático em caso de falha.
Use quando o cliente pedir "mudar horário", "remarcar", "reagendar", "trocar data".
FLUXO OBRIGATÓRIO:
1. Chame get_my_appointments para obter o booking_id
2. Se tiver múltiplos agendamentos: pergunte qual quer reagendar
3. Quando tiver booking_id + nova data/hora → chame esta tool
NUNCA peça para o cliente cancelar e criar novo manualmente.
NUNCA chame cancel_appointment + create_appointment separadamente para reagendar.`,
        input_schema: {
          type: 'object' as const,
          properties: {
            booking_id: { type: 'string', description: 'ID UUID do agendamento obtido via get_my_appointments' },
            new_date: { type: 'string', description: 'Nova data no formato YYYY-MM-DD' },
            new_time: { type: 'string', description: 'Novo horário no formato HH:MM' },
          },
          required: ['booking_id', 'new_date', 'new_time'],
        },
      },
      {
        name: 'check_availability',
        description: 'Verifica se o profissional atende numa data/horário específico SEM criar agendamento. Checa expediente E conflitos com agendamentos existentes. SEMPRE chame assim que o cliente mencionar uma data/horário, ANTES de pedir nome. Se available=false: informe imediatamente. Se available=true: peça o nome sem prometer "está disponível" (a confirmação real vem só após create_appointment).',
        input_schema: {
          type: 'object' as const,
          properties: {
            date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
            time: { type: 'string', description: 'Horário no formato HH:MM (opcional — para verificar se está dentro do expediente)' },
          },
          required: ['date'],
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

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: cachedSystem,
        tools,
        messages,
      });

      console.log(`💰 Cache: create=${(response.usage as any).cache_creation_input_tokens ?? 0} read=${(response.usage as any).cache_read_input_tokens ?? 0} input=${response.usage.input_tokens}`);

      // Loop agentic: suporta encadeamento de tools (ex: get_my_appointments → cancel_appointment)
      let currentResponse = response;
      let currentMessages: typeof messages = [...messages];

      for (let iteration = 0; iteration < 5; iteration++) {
        if (currentResponse.stop_reason !== 'tool_use') break;

        const toolUseBlock = currentResponse.content.find(
          (c): c is { type: 'tool_use'; id: string; name: string; input: Record<string, any> } =>
            c.type === 'tool_use'
        );
        if (!toolUseBlock) break;

        console.log(`🛠️ Tool use [${iteration}]: ${toolUseBlock.name}`, JSON.stringify(toolUseBlock.input));

        let toolResult: any;

        if (toolUseBlock.name === 'create_appointment') {
          toolResult = await this.createAppointment(toolUseBlock.input as any, professionalId);
        } else if (toolUseBlock.name === 'get_my_appointments') {
          toolResult = await this.getMyAppointments(context.phone, professionalId);
        } else if (toolUseBlock.name === 'cancel_appointment') {
          toolResult = await this.cancelAppointment(toolUseBlock.input.booking_id, professionalId);
        } else if (toolUseBlock.name === 'reschedule_appointment') {
          toolResult = await this.rescheduleAppointment(
            toolUseBlock.input.booking_id,
            toolUseBlock.input.new_date,
            toolUseBlock.input.new_time,
            professionalId,
          );
        } else if (toolUseBlock.name === 'check_availability') {
          toolResult = await this.checkAvailability(toolUseBlock.input.date, toolUseBlock.input.time, professionalId);
        } else {
          console.warn('Tool desconhecida:', toolUseBlock.name);
          break;
        }

        console.log(`📊 Tool result [${iteration}]:`, JSON.stringify(toolResult));

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: currentResponse.content },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify(toolResult),
              },
            ],
          },
        ];

        currentResponse = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: cachedSystem,
          tools,
          messages: currentMessages,
        });

        console.log(`💰 Cache [${iteration}]: create=${(currentResponse.usage as any).cache_creation_input_tokens ?? 0} read=${(currentResponse.usage as any).cache_read_input_tokens ?? 0}`);
      }

      const textBlock = (currentResponse.content as any[]).find(c => c.type === 'text');
      const responseText = textBlock?.text ?? '';

      if (!responseText || responseText.trim().length === 0) {
        console.error('❌ Claude retornou resposta vazia');
        return 'Desculpe, não consegui processar sua mensagem. Pode repetir? 😊';
      }

      // Detectar gibberish: palavras muito longas sem espaços (≥50 chars) são sinal de resposta corrompida
      const hasGibberish = responseText.split(/\s+/).some((word: string) => word.replace(/[^\w]/g, '').length >= 50);
      if (hasGibberish) {
        console.error('❌ Claude retornou gibberish:', responseText.substring(0, 120));
        return 'Desculpe, tive uma falha técnica no momento. Por favor, tente novamente em alguns instantes. 😊';
      }

      return responseText;

    } catch (error: any) {
      const errMsg = error?.message ?? '';
      const errBody = error?.error ? JSON.stringify(error.error) : undefined;
      console.error('❌ Erro na API Anthropic:', {
        status: error?.status,
        message: errMsg,
        type: error?.constructor?.name,
        error_body: errBody,
      });

      if (error?.status === 429) {
        console.error('⚠️ Rate limit atingido');
        return 'Estamos com muito volume agora. Por favor, tente novamente em alguns minutos. 😊';
      }
      if (error?.code === 'ETIMEDOUT' || errMsg.includes('timeout')) {
        console.error('⏱️ Timeout na API Anthropic');
        return 'Desculpe a demora. Pode repetir sua mensagem? 😊';
      }
      if (error?.status === 401 || error?.status === 403) {
        console.error('🔑 Erro de autenticação na API Anthropic');
        return 'Estou com uma dificuldade técnica no momento. Entre em contato diretamente pelo telefone.';
      }
      if (errMsg.includes('credit balance') || errBody?.includes('credit balance')) {
        console.error('💳 CONTA ANTHROPIC SEM CRÉDITOS — adicionar créditos em console.anthropic.com');
        return 'Estou temporariamente fora do ar para manutenção. Por favor, entre em contato diretamente pelo telefone. 😊';
      }

      return 'Desculpe, tive um problema técnico. Por favor, tente novamente ou entre em contato pelo telefone. 😊';
    }
  }

  private async checkAvailability(date: string, time: string | undefined, professionalId: string) {
    const normalizedDate = normalizeDate(date);
    const dayInt = new Date(normalizedDate + 'T12:00:00Z').getUTCDay();
    const dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

    // Verificar dia bloqueado (blocked_dates)
    const { data: blockedDay } = await this.supabase
      .from('blocked_dates')
      .select('reason')
      .eq('professional_id', professionalId)
      .eq('blocked_date', normalizedDate)
      .limit(1)
      .maybeSingle();

    if (blockedDay) {
      const reason = blockedDay.reason ?? 'indisponível';
      return {
        available: false,
        reason: 'blocked_date',
        message: `Esse dia está bloqueado (${reason}). Por favor, escolha outra data.`,
      };
    }

    // Verificar período bloqueado (blocked_periods — férias, recesso)
    const { data: blockedPeriod } = await this.supabase
      .from('blocked_periods')
      .select('reason, end_date')
      .eq('professional_id', professionalId)
      .lte('start_date', normalizedDate)
      .gte('end_date', normalizedDate)
      .limit(1)
      .maybeSingle();

    if (blockedPeriod) {
      const reason = blockedPeriod.reason ?? 'férias';
      const endFormatted = new Date(blockedPeriod.end_date + 'T12:00:00Z')
        .toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      return {
        available: false,
        reason: 'blocked_period',
        message: `Estou de ${reason} até ${endFormatted}. Escolha uma data após esse período!`,
      };
    }

    const { data: dayWH } = await this.supabase
      .from('working_hours')
      .select('start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('day_of_week', dayInt)
      .eq('is_available', true)
      .maybeSingle();

    if (!dayWH) {
      return { available: false, reason: 'day_off', message: `Não atendo ${dayNames[dayInt]}s.` };
    }

    const workStart = dayWH.start_time.slice(0, 5);
    const workEnd = dayWH.end_time.slice(0, 5);

    if (time) {
      const normalizedTime = normalizeTime(time);
      const reqMins = timeToMinutes(normalizedTime);
      const startMins = timeToMinutes(dayWH.start_time);
      const endMins = timeToMinutes(dayWH.end_time);
      if (reqMins < startMins || reqMins >= endMins) {
        return {
          available: false,
          reason: 'outside_hours',
          message: `Atendo ${dayNames[dayInt]}s das ${workStart} às ${workEnd}, mas esse horário está fora do expediente.`,
          work_hours: `${workStart} – ${workEnd}`,
        };
      }

      // Verificar conflitos reais com agendamentos existentes (buffer de 15 min)
      const { data: existingBookings } = await this.supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('professional_id', professionalId)
        .eq('booking_date', normalizedDate)
        .neq('status', 'cancelled')
        .neq('status', 'completed');

      if (existingBookings && existingBookings.length > 0) {
        const BUFFER = 15;
        const ASSUMED_DURATION = 60; // assume 60 min se não soubermos o serviço ainda
        const reqEnd = reqMins + ASSUMED_DURATION;
        const conflict = existingBookings.find((b) => {
          const bStart = timeToMinutes(b.start_time);
          const bEnd = (b.end_time ? timeToMinutes(b.end_time) : bStart + 60) + BUFFER;
          return reqMins < bEnd && reqEnd > bStart;
        });
        if (conflict) {
          const alternative = suggestAlternative(normalizedDate, existingBookings, ASSUMED_DURATION, dayWH.start_time, dayWH.end_time, normalizedTime);
          return {
            available: false,
            reason: 'slot_taken',
            message: `Esse horário já está ocupado.${alternative ? ` O próximo horário disponível é às ${alternative}.` : ''}`,
            work_hours: `${workStart} – ${workEnd}`,
            suggested_time: alternative ?? null,
          };
        }
      }
    }

    return { available: true, work_hours: `${workStart} – ${workEnd}` };
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
      const bookingDate = normalizeDate(data.date);
      const bookingTime = normalizeTime(data.time);
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
          message: `Esse horário já passou! Já são ${nowLabel} agora. Qual horário você prefere?`,
        };
      }

      // 0. Verificar se data está bloqueada (blocked_dates ou blocked_periods)
      const { data: blockedDayCA } = await this.supabase
        .from('blocked_dates')
        .select('reason')
        .eq('professional_id', professionalId)
        .eq('blocked_date', bookingDate)
        .limit(1)
        .maybeSingle();

      if (blockedDayCA) {
        const reason = blockedDayCA.reason ?? 'indisponível';
        return {
          success: false,
          error: 'blocked_date',
          message: `Esse dia está bloqueado (${reason}). Por favor, escolha outra data.`,
        };
      }

      const { data: blockedPeriodCA } = await this.supabase
        .from('blocked_periods')
        .select('reason, end_date')
        .eq('professional_id', professionalId)
        .lte('start_date', bookingDate)
        .gte('end_date', bookingDate)
        .limit(1)
        .maybeSingle();

      if (blockedPeriodCA) {
        const reason = blockedPeriodCA.reason ?? 'férias';
        const endFormatted = new Date(blockedPeriodCA.end_date + 'T12:00:00Z')
          .toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
        return {
          success: false,
          error: 'blocked_period',
          message: `Estou de ${reason} até ${endFormatted}. Que tal agendarmos para depois disso?`,
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

      // 2. Validar dia e horário — ANTES de qualquer outra checagem
      // Evita oferecer datas/dias inválidos em mensagens de erro de duplicata
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

      // 3. Verificar agendamentos futuros do mesmo cliente (duplicatas)
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
        const BUFFER = 15; // minutos livres após cada atendimento
        for (const b of existingBookings) {
          const bStart = timeToMinutes(b.start_time);
          const bEnd = (b.end_time ? timeToMinutes(b.end_time) : bStart + 60) + BUFFER;
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
              ? suggestAlternative(bookingDate, existingBookings, duration, todayWH.start_time, todayWH.end_time, bookingTime)
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

  private buildSystemPrompt(context: ConversationContext, currentMessage: string): string {
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

    // Mesma heurística do processMessage: só é "primeira mensagem" se o histórico está
    // vazio E a mensagem parece uma saudação. Protege contra cold starts onde Redis
    // falha e o histórico aparece vazio mesmo não sendo a primeira mensagem real.
    const looksLikeGreeting = /^[\s]*?(oi\b|olá|ola\b|oii|hello\b|hi\b|hey\b|bom dia|boa tarde|boa noite|tudo bem|e aí|good morning|good afternoon)/i.test(currentMessage.trim());
    const isFirstMessage = history.length === 0 && looksLikeGreeting;

    console.log(`📝 Prompt | isFirstMessage=${isFirstMessage} | historyLen=${history.length} | bot="${botName}"`);

    const criticalRules = `# ⚠️ REGRAS ABSOLUTAS — LEIA PRIMEIRO ⚠️

## REGRA #0: NUNCA COMECE COM SAUDAÇÃO OU APRESENTAÇÃO
❌ PROIBIDO iniciar qualquer resposta com "Olá!", "Oi!", "Sou [nome]" ou apresentações
❌ PROIBIDO saudar o cliente em qualquer mensagem que não seja a PRIMEIRA da conversa
✅ Se a mensagem do cliente menciona data/dia/horário → chame check_availability IMEDIATAMENTE como PRIMEIRA ação
✅ Se o cliente pede algo → responda DIRETAMENTE ao pedido sem preâmbulos

## REGRA #1: NUNCA CONFIRME SEM CHAMAR A TOOL
❌ PROIBIDO dizer "Agendado!" sem chamar create_appointment
❌ PROIBIDO confirmar horário baseado apenas na conversa
✅ Chame create_appointment → aguarde resultado → confirme APENAS se success=true

CORRETO → Cliente: "Quero corte dia 25 às 10h, sou João"
→ [chama create_appointment] → retorna success=true → "Agendado João! ✅"

ERRADO → Cliente: "Quero corte dia 25 às 10h, sou João"
→ "Agendado João! ✅" ← SEM CHAMAR TOOL = agendamento NÃO EXISTE NO BANCO

## REGRA #2: SEMPRE USE get_my_appointments PARA CONSULTAR AGENDAMENTOS
❌ PROIBIDO listar agendamentos do histórico da conversa
❌ PROIBIDO assumir que agendamento existe porque "lembra" de ter criado
✅ Chame get_my_appointments → use APENAS os dados retornados pela tool

Gatilhos obrigatórios para chamar get_my_appointments:
- "Tenho agendamento?" / "Estou agendada?" / "Quando é meu horário?"
- "Me confirma" / "Tem certeza?" / "Estou marcada mesmo?"
- Qualquer dúvida sobre agendamentos futuros

## REGRA #3: TODO AGENDAMENTO É REAL — NÃO EXISTE "TESTE"
❌ NÃO existe distinção entre agendamento "de teste" e "real"
✅ Se create_appointment retornou success=true → agendamento EXISTE no banco
✅ Se cliente disser "era só um teste" → use cancel_appointment para remover

## REGRA #4: HISTÓRICO É MENSAGENS, NÃO É BANCO DE DADOS
⚠️ O histórico mostra mensagens trocadas, não o estado real do banco
⚠️ Você pode ter dito "Agendado!" sem chamar a tool → agendamento pode não existir
⚠️ SEMPRE use tools para verificar realidade, NUNCA confie apenas no histórico

## REGRA #5: NUNCA CONFIRME SERVIÇOS QUE NÃO ESTÃO NA LISTA
A seção "Serviços:" abaixo lista TODOS os serviços disponíveis. Não existe nenhum outro.
❌ PROIBIDO dizer "sim, fazemos isso" para serviço que não está na lista
❌ PROIBIDO coletar nome/data/horário para serviço que não existe
✅ Se cliente pedir serviço não listado → informe imediatamente que não oferece esse serviço
✅ Depois, sugira os serviços reais da lista que possam ser relevantes

CORRETO → Cliente: "vc faz unhas?" (unhas não está na lista)
→ "Infelizmente não oferecemos serviços de unha. Nossos serviços são: [lista real]"

ERRADO → "Sim! Fazemos vários serviços, incluindo unhas!" ← MENTIRA, serviço não existe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    // Se custom_system_prompt preenchido → usar com substituição de variáveis
    if (botConfig?.custom_system_prompt) {
      const vars: Record<string, string> = {
        '{business_name}': businessInfo.business_name,
        '{bot_name}': botName,
        '{phone}': phone,
        '{services}': this.formatServices(businessInfo.services),
        '{schedule}': this.formatSchedule(businessInfo.schedule),
        '{location}': businessInfo.location,
        '{conversation_history}': '(histórico disponível nas mensagens acima)',
      };
      let prompt = botConfig.custom_system_prompt;
      for (const [key, value] of Object.entries(vars)) {
        prompt = prompt.split(key).join(value);
      }
      return prompt;
    }

    return `${criticalRules}

# IDENTIDADE
${botConfig?.bot_name
      ? `Você é ${botName}, assistente do ${businessInfo.business_name}.`
      : `Você é assistente do ${businessInfo.business_name}.`} Telefone do cliente: ${phone} — nunca peça.
Tom: ${this.getPersonalityInstructions(personality)}
Responda SEMPRE no idioma do cliente.

# APRESENTAÇÃO
${isFirstMessage
      ? (botConfig?.bot_name && greetingMsg)
        ? `PRIMEIRA MENSAGEM: comece com EXATAMENTE: "Olá! Sou ${botName}. ${greetingMsg}"`
        : botConfig?.bot_name
          ? `PRIMEIRA MENSAGEM: comece OBRIGATORIAMENTE com: "Olá! Sou ${botName}, assistente do ${businessInfo.business_name}. Como posso ajudar? 😊" — NÃO omita o nome do negócio. NÃO liste serviços proativamente.`
          : greetingMsg
            ? `PRIMEIRA MENSAGEM: responda com EXATAMENTE este texto (sem alterar): "${greetingMsg}"`
            : `PRIMEIRA MENSAGEM: comece OBRIGATORIAMENTE com: "Olá! Bem-vindo ao ${businessInfo.business_name}! Como posso ajudar? 😊" — NÃO omita o nome do negócio. NÃO liste serviços proativamente.`
      : `PROIBIDO apresentar-se ou saudar o cliente. A conversa já está em curso — vá DIRETAMENTE ao pedido. Se a mensagem menciona data, dia ou horário: chame check_availability IMEDIATAMENTE como PRIMEIRA ação, antes de qualquer texto.`}

# HISTÓRICO DA CONVERSA
O histórico completo da conversa está disponível nas mensagens acima (contexto da conversa).

⚠️ ATENÇÃO: O histórico mostra apenas MENSAGENS trocadas — não é fonte confiável de estado de agendamentos.
- Se você disse "Agendado!" mas não chamou create_appointment → agendamento pode NÃO EXISTIR
- SEMPRE use get_my_appointments para verificar agendamentos reais
- NUNCA liste agendamentos baseado apenas no histórico

# REGRAS DE CONTEXTO
- Nunca pergunte algo já respondido no histórico (nome, serviço, data, horário)
- Use informações do histórico para contexto, mas NUNCA para afirmar estado de agendamentos
- Se o histórico mostrar várias perguntas seguidas sem resposta, responda TODAS numa só mensagem

# AGENDAMENTO PARA TERCEIROS
Se o cliente pedir para agendar por outra pessoa (amiga, familiar, etc.), responda IMEDIATAMENTE com uma mensagem gentil como:
"Que fofo que quer agendar para sua amiga! 😊 Para garantir que tudo fique organizado no nome dela, o ideal é que ela nos chame diretamente por este mesmo número pelo WhatsApp dela. Assim o agendamento fica certinho no perfil dela! Se precisar de ajuda com mais alguma coisa, estou aqui."
- Adapte o tom à personalidade configurada (sem emojis se for Profissional)
- NÃO colete dados da terceira pessoa, NÃO tente criar o agendamento
- NÃO diga "claro que sim" para depois recusar — redirecione logo na primeira menção

# AGENDAMENTO
Para agendar: nome, serviço, data, horário. Pergunte apenas o que falta.
${alwaysConfirm
      ? 'Com todos os dados → SEMPRE peça confirmação ao cliente antes de chamar create_appointment. Exemplo: "Confirma agendamento para dia 25 às 10h?" Aguarde resposta positiva, então chame a tool.'
      : autoBook
        ? 'Com todos os dados → chame create_appointment imediatamente sem pedir confirmação.'
        : 'Com todos os dados → peça confirmação ao cliente, então chame create_appointment após resposta positiva.'
    }
${askAdditional ? '- Pergunte preferências/observações adicionais.' : ''}
- Serviço [A domicílio] ou [Salão ou domicílio]: colete endereço do cliente antes.
- Confirme "Agendado!" APENAS se create_appointment retornar success: true.
- Em caso de erro técnico: "Houve um problema. Por favor, entre em contato."
- NUNCA diga "vou verificar disponibilidade" — a tool faz isso automaticamente.
- NUNCA sugira uma lista de horários disponíveis — peça ao cliente qual horário quer e tente create_appointment. Se não estiver disponível, a tool retorna alternativas automaticamente.

# CONSULTA DE AGENDAMENTOS
SEMPRE chame get_my_appointments ANTES de responder sobre agendamentos do cliente.

Perguntas que EXIGEM get_my_appointments (não responda antes de chamar):
- "Tenho agendamento?" / "Estou agendada?" / "Quando é meu horário?"
- "Me confirma" / "Tem certeza?" / "Estou marcada mesmo?"
- QUALQUER pergunta sobre agendamentos futuros

FLUXO OBRIGATÓRIO:
1. Cliente pergunta sobre agendamentos
2. Chame get_my_appointments IMEDIATAMENTE
3. Se appointments[] vazio: "Não encontrei agendamentos futuros confirmados para você."
4. Se appointments[] tem dados: liste APENAS o que veio da tool

PROIBIDO:
❌ "Você tem agendamento dia X" sem chamar tool
❌ "Conforme combinamos anteriormente..."
❌ Assumir que agendamento existe porque histórico menciona

# REAGENDAMENTO
Quando o cliente pedir "mudar horário", "remarcar", "reagendar", "trocar data":
1. Chame get_my_appointments IMEDIATAMENTE para listar agendamentos futuros
2. Se tiver apenas 1: pergunte a nova data/hora desejada
3. Se tiver múltiplos: mostre a lista e pergunte qual quer reagendar
4. Quando souber booking_id + nova data/hora → chame reschedule_appointment
5. Confirme o reagendamento mostrando: data/hora ANTIGA → data/hora NOVA

ERROS da tool reschedule_appointment:
- new_slot_unavailable → repasse 'message', pergunte outra data/hora
- not_found / not_confirmed → informe que não encontrou agendamento válido
- slot_taken_race → horário foi ocupado durante processamento, peça outro horário

PROIBIDO no reagendamento:
❌ Chamar cancel_appointment + create_appointment separadamente para reagendar
❌ Pedir para o cliente cancelar e criar novo manualmente
❌ Confirmar "reagendado" sem chamar reschedule_appointment e receber success: true

# RETENÇÃO — NUNCA DEIXE O CLIENTE IR SEM TENTAR
Quando o cliente estiver insatisfeito, quiser cancelar ou ameaçar ir embora:
1. PRIMEIRO: reconheça a frustração com empatia genuína e peça desculpas
2. SEGUNDO: tente entender o motivo e ofereça uma solução concreta:
   - Problema com horário → sugira alternativas imediatamente
   - Problema com atendimento → diga que vai passar o feedback para a profissional
   - Dúvida sobre disponibilidade → consulte get_my_appointments e mostre a situação real
3. TERCEIRO: se o cliente ainda quiser cancelar → ofereça reagendar para outro horário ANTES de cancelar
   Exemplo: "Entendo! Antes de cancelar, posso verificar outro horário que funcione melhor para você?"
4. QUARTO: apenas se o cliente confirmar que quer cancelar mesmo assim → processe o cancelamento
5. Se a situação for muito delicada ou o cliente pedir para falar com uma pessoa real → diga:
   "Vou te conectar com [nome da profissional] diretamente. Por favor, aguarde um momento."
   E encerre a conversa do bot (não tente mais resolver sozinho).

NUNCA aceite um cancelamento de primeira — sempre tente salvar o cliente primeiro.

# CANCELAMENTO
Para cancelar um agendamento (apenas após tentativa de retenção):
1. Chame get_my_appointments para ver os agendamentos reais do cliente
2. Mostre a lista e ofereça reagendar ANTES de cancelar
3. Se cliente confirmar cancelamento → chame cancel_appointment com o booking_id
- Diga "Cancelado!" APENAS se cancel_appointment retornar success: true.
- NUNCA diga "vou cancelar" ou "cancelei" sem chamar cancel_appointment.
- Todo agendamento criado pelo bot é REAL no banco — não existe "teste" vs "real".

# ERROS DA TOOL create_appointment
- past_time / past_time_close → repasse 'message', pergunte outro horário
- day_unavailable → repasse 'message', pergunte outro dia
- outside_hours → repasse 'message', pergunte horário dentro do expediente
- unavailable → horário ocupado, sugira alternativo do campo 'message'
- duplicate_same_day → repasse 'message', aguarde: "remarcar" ou "é outro serviço"
  - "remarcar": crie com novo horário; "outro serviço": colete serviço e crie
- duplicate_nearby → repasse 'message', aguarde: "remarcar" ou "confirmar dois"
  - "remarcar": confirme o novo; "confirmar dois": chame create_appointment normalmente

# DATA E HORA
${(() => {
      const dublinNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Dublin' }));
      const toISO = (d: Date) => d.toISOString().split('T')[0];
      const toLabel = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
      const days: string[] = [];
      for (let i = 0; i <= 7; i++) {
        const d = new Date(dublinNow);
        d.setDate(d.getDate() + i);
        const iso = toISO(d);
        const label = toLabel(new Date(iso + 'T12:00:00Z'));
        if (i === 0) days.push(`Hoje: ${iso} (${label})`);
        else if (i === 1) days.push(`Amanhã: ${iso} (${label})`);
        else days.push(`${label}: ${iso}`);
      }
      return days.join('\n');
    })()}
Formato date: YYYY-MM-DD | Formato time: HH:MM
Use SEMPRE as datas acima — nunca calcule datas manualmente.

# NEGÓCIO
${businessInfo.business_name}${businessInfo.description ? ` — ${businessInfo.description}` : ''}
Local: ${businessInfo.location}${businessInfo.website ? `\nSite/Portfólio: ${businessInfo.website}` : ''}

Serviços:
${this.formatServices(businessInfo.services)}

Horário:
${this.formatSchedule(businessInfo.schedule)}
${businessInfo.ai_instructions ? `\nInstruções: ${businessInfo.ai_instructions}` : ''}
${unavailableMsg ? `\nIndisponível: ${unavailableMsg}` : ''}

# CONFIRMAÇÃO DE AGENDAMENTO
${confirmationMsg || `Agendado [Nome]! ✅\n[Data] [Hora] - [Serviço] €[Preço]\nNos vemos em breve! 😊`}

# VERIFICAÇÃO DE DISPONIBILIDADE — OBRIGATÓRIO ANTES DE COLETAR DADOS
Quando o cliente mencionar uma data, dia ou horário (ex: "amanhã", "sábado", "dia 25", "às 9h"):
1. Chame check_availability IMEDIATAMENTE com a data mencionada
2. Se available=false → informe o motivo NA HORA, antes de pedir nome ou qualquer outro dado
3. Só pergunte nome/horário DEPOIS que check_availability retornar available=true

FLUXO CORRETO:
Cliente: "quero cortar amanhã às 9h"
→ [chama check_availability com date="amanhã", time="09:00"]
→ available=false → informe o motivo. NUNCA sugira horário alternativo específico — apenas diga quais dias atende e pergunte o que o cliente prefere.
→ available=true → peça o nome SEM dizer "está disponível" (ex: "Para confirmar, qual é o seu nome?")
  A disponibilidade real só é garantida após create_appointment.

PROIBIDO ao rejeitar data/horário:
❌ "Que tal segunda às 9h?" — nunca sugira horário sem verificar com check_availability
❌ "Posso te oferecer segunda-feira às 9h" — idem
✅ "Não atendo domingos. Que dia da semana prefere?" — deixe o cliente propor, depois verifique

# PROIBIDO
- Apresentar-se mais de uma vez
- Perguntar o que já foi dito
- Confirmar agendamento sem chamar create_appointment e receber success: true
- Dizer "cancelado" sem chamar cancel_appointment e receber success: true
- Listar ou mencionar agendamentos sem chamar get_my_appointments
- Sugerir lista de horários disponíveis sem tentar create_appointment
- Pedir telefone (já temos: ${phone})
- Confirmar ou insinuar que oferece serviço que não está na lista de "Serviços:" acima
- Coletar dados (nome, data, horário) para serviço que não existe na lista
- Pedir nome ou horário antes de chamar check_availability quando cliente menciona data/dia
- Usar cancel_appointment + create_appointment para reagendar (use reschedule_appointment)
- Confirmar reagendamento sem chamar reschedule_appointment e receber success: true
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

  private formatSchedule(schedule: Record<string, { start: string; end: string }>): string {
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return dayNames.map((name, i) => {
      const hours = schedule[String(i)];
      return hours
        ? `${name}: ${hours.start.slice(0, 5)} – ${hours.end.slice(0, 5)}`
        : `${name}: ❌ Não atende`;
    }).join('\n');
  }

  private async getConversationContext(
    phone: string,
    businessId: string
  ): Promise<ConversationContext> {
    // 1. Buscar ou criar conversa
    let { data: conversation, error: convError } = await this.supabase
      .from('whatsapp_conversations')
      .upsert(
        { user_id: businessId, customer_phone: phone },
        { onConflict: 'user_id,customer_phone', ignoreDuplicates: false }
      )
      .select('id, language')
      .single();

    // Fallback: upsert com DO UPDATE no-op pode retornar 0 rows (PostgREST).
    // Se isso acontecer, busca diretamente a conversa existente.
    if (convError || !conversation) {
      const { data: existing } = await this.supabase
        .from('whatsapp_conversations')
        .select('id, language')
        .eq('user_id', businessId)
        .eq('customer_phone', phone)
        .maybeSingle();
      if (existing) {
        conversation = existing;
        convError = null;
      }
    }

    if (!conversation) {
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
    // Valida o conversationId para evitar servir histórico stale quando a conversa foi recriada
    if (history.length === 0) {
      const memEntry = memoryCache.get(cacheKey);
      if (memEntry) {
        if (memEntry.conversationId !== conversation.id) {
          // Conversa foi recriada (ex: limpeza de testes) — descartar cache stale
          memoryCache.delete(cacheKey);
          console.log(`🗑️ Tier 3 stale detectado (conversation ID mudou) — cache descartado para ${cacheKey}`);
        } else {
          const fresh = memEntry.messages.filter(m => Date.now() - m.ts < 24 * 60 * 60 * 1000);
          if (fresh.length > 0) {
            history = fresh.map(m => ({ role: m.role, content: m.content }));
            historySource = 'memory';
          }
        }
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
        .select('id, business_name, bio, city, slug')
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
        website: professional?.slug ? `${process.env.NEXT_PUBLIC_BASE_URL}/${professional.slug}` : null,
        ai_instructions: aiInstructions?.instructions ?? '',
        botConfig: botConfig ?? null,
      },
    };
  }

  private async getMyAppointments(phone: string, professionalId: string) {
    const dublinNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Dublin' }));
    const today = `${dublinNow.getFullYear()}-${String(dublinNow.getMonth() + 1).padStart(2, '0')}-${String(dublinNow.getDate()).padStart(2, '0')}`;

    const { data: bookings } = await this.supabase
      .from('bookings')
      .select('id, booking_date, start_time, services(name, price)')
      .eq('professional_id', professionalId)
      .eq('client_phone', phone)
      .gte('booking_date', today)
      .eq('status', 'confirmed')
      .order('booking_date', { ascending: true });

    if (!bookings || bookings.length === 0) {
      return { appointments: [], message: 'Nenhum agendamento futuro confirmado encontrado.' };
    }

    return {
      appointments: bookings.map((b) => ({
        id: b.id,
        date: b.booking_date,
        date_formatted: new Date(b.booking_date + 'T12:00:00Z').toLocaleDateString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
        }),
        time: b.start_time.slice(0, 5),
        service: (b.services as any)?.name ?? 'Serviço',
        price: (b.services as any)?.price ?? 0,
      })),
    };
  }

  private async rescheduleAppointment(
    bookingId: string,
    newDate: string,
    newTime: string,
    professionalId: string,
  ): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    new_appointment_id?: string;
    old_date?: string;
    old_time?: string;
    new_date_formatted?: string;
    new_time?: string;
  }> {
    try {
      const normalizedDate = normalizeDate(newDate);
      const normalizedTime = normalizeTime(newTime);

      // 1. Buscar agendamento existente
      const { data: existing } = await this.supabase
        .from('bookings')
        .select('id, booking_date, start_time, service_id, client_name, client_phone, client_email, notes, service_location, customer_address, status')
        .eq('id', bookingId)
        .eq('professional_id', professionalId)
        .maybeSingle();

      if (!existing) {
        return { success: false, error: 'not_found', message: 'Agendamento não encontrado.' };
      }
      if (existing.status !== 'confirmed') {
        return { success: false, error: 'not_confirmed', message: `Agendamento não está confirmado (status: ${existing.status}).` };
      }

      // 2. Verificar disponibilidade do novo horário
      const avail = await this.checkAvailability(normalizedDate, normalizedTime, professionalId);
      if (!avail.available) {
        return { success: false, error: 'new_slot_unavailable', message: avail.message ?? 'Novo horário não disponível.' };
      }

      // 3. Calcular horário de término
      const { data: svc } = await this.supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', existing.service_id)
        .maybeSingle();
      const duration = svc?.duration_minutes ?? 60;
      const [h, m] = normalizedTime.split(':').map(Number);
      const endTotal = h * 60 + m + duration;
      const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}:00`;

      // 4. Cancelar agendamento antigo
      const { error: cancelErr } = await this.supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: 'client',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Reagendado pelo cliente via WhatsApp',
        })
        .eq('id', bookingId);

      if (cancelErr) {
        return { success: false, error: 'cancel_failed', message: 'Erro ao cancelar o agendamento anterior.' };
      }

      // 5. Criar novo agendamento (sem verificação de duplicata — é um reagendamento explícito)
      const { data: newBooking, error: insertErr } = await this.supabase
        .from('bookings')
        .insert({
          professional_id: professionalId,
          service_id: existing.service_id,
          booking_date: normalizedDate,
          start_time: `${normalizedTime}:00`,
          end_time: endTime,
          client_name: existing.client_name,
          client_phone: existing.client_phone,
          client_email: existing.client_email ?? null,
          notes: existing.notes ?? null,
          status: 'confirmed',
          service_location: existing.service_location ?? 'in_salon',
          customer_address: existing.customer_address ?? null,
        })
        .select('id')
        .single();

      if (insertErr || !newBooking) {
        // Rollback: restaurar agendamento antigo
        await this.supabase
          .from('bookings')
          .update({ status: 'confirmed', cancelled_by: null, cancelled_at: null, cancellation_reason: null })
          .eq('id', bookingId);

        if (insertErr?.code === '23505') {
          return { success: false, error: 'slot_taken_race', message: 'O novo horário foi ocupado durante o processamento. Escolha outro horário.' };
        }
        return { success: false, error: 'insert_failed', message: 'Erro ao criar novo agendamento. O horário anterior foi mantido.' };
      }

      const oldDateFmt = new Date(existing.booking_date + 'T12:00:00Z')
        .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
      const newDateFmt = new Date(normalizedDate + 'T12:00:00Z')
        .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

      console.log(`✅ Reagendado: ${bookingId} → ${newBooking.id} | ${existing.booking_date} ${existing.start_time} → ${normalizedDate} ${normalizedTime}`);

      return {
        success: true,
        new_appointment_id: newBooking.id,
        old_date: oldDateFmt,
        old_time: existing.start_time.slice(0, 5),
        new_date_formatted: newDateFmt,
        new_time: normalizedTime,
        message: `Reagendado com sucesso! Cancelei ${oldDateFmt} às ${existing.start_time.slice(0, 5)} e marquei ${newDateFmt} às ${normalizedTime}.`,
      };
    } catch (err) {
      console.error('rescheduleAppointment: erro inesperado:', err);
      return { success: false, error: 'unexpected', message: 'Erro inesperado ao reagendar.' };
    }
  }

  private async cancelAppointment(bookingId: string, professionalId: string) {
    const { data: booking } = await this.supabase
      .from('bookings')
      .select('id, status, booking_date, start_time')
      .eq('id', bookingId)
      .eq('professional_id', professionalId)
      .maybeSingle();

    if (!booking) {
      return { success: false, error: 'Agendamento não encontrado.' };
    }
    if (booking.status !== 'confirmed') {
      return { success: false, error: `Agendamento não pode ser cancelado (status atual: ${booking.status}).` };
    }

    const { error } = await this.supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: 'client',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelado pelo cliente via WhatsApp',
      })
      .eq('id', bookingId)
      .eq('professional_id', professionalId);

    if (error) {
      console.error('cancelAppointment error:', error);
      return { success: false, error: 'Erro ao cancelar. Por favor, tente novamente.' };
    }

    console.log('✅ Agendamento cancelado:', bookingId);
    return {
      success: true,
      date_formatted: new Date(booking.booking_date + 'T12:00:00Z').toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
      }),
      time: booking.start_time.slice(0, 5),
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
