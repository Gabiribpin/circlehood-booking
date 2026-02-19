import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { detectLanguage } from './language-detector';
import { classifyIntent } from './intent-classifier';
import { ConversationCache } from '@/lib/redis/conversation-cache';

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

    // 5. Salvar no Redis (cache persistente — fonte principal)
    const cacheKey = `${businessId}_${phone}`;
    ConversationCache.addMessages(cacheKey, [
      { role: 'user', content: message, timestamp: Date.now() },
      { role: 'assistant', content: response, timestamp: Date.now() + 1 },
    ]).catch(err => console.error('❌ Redis save falhou:', err));

    // 6. Salvar no banco como backup (fire-and-forget — Redis já tem os dados)
    this.saveToHistory(context.conversationId, message, response)
      .catch(err => console.error('⚠️ saveToHistory falhou (Redis já salvou):', err));

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

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      tools,
      messages,
    });

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

        // Segunda chamada com o resultado da tool
        const followUp = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
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
  ): Promise<{ success: boolean; error?: string; appointment_id?: string; service_name?: string; price?: number; date?: string; time?: string }> {
    try {
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

      // 2. Calcular horário de término
      const [hours, minutes] = data.time.split(':').map(Number);
      const duration = service.duration_minutes ?? 60;
      const endTotalMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(endTotalMinutes / 60) % 24;
      const endMins = endTotalMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;

      // 3. Inserir agendamento na tabela bookings
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .insert({
          professional_id: professionalId,
          service_id: service.id,
          booking_date: data.date,
          start_time: `${data.time}:00`,
          end_time: endTime,
          client_name: data.customer_name,
          client_phone: data.customer_phone,
          notes: data.notes || 'Agendado via WhatsApp Bot',
          status: 'confirmed',
          created_via: 'whatsapp_bot',
          service_location: data.service_location || 'in_salon',
          customer_address: data.customer_address || null,
        })
        .select('id')
        .single();

      if (bookingError || !booking) {
        console.error('createAppointment: erro ao inserir booking:', bookingError);
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
    const { businessInfo, language, phone, history } = context;
    const botConfig = businessInfo.botConfig;

    console.log('📝 buildSystemPrompt | historyLength:', history.length, '| botConfig:', botConfig
      ? `bot_name="${botConfig.bot_name}" personality="${botConfig.bot_personality}" greeting=${!!botConfig.greeting_message}`
      : 'NULL'
    );

    const conversationHistory = history.length > 0
      ? history.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n')
      : '(sem histórico anterior)';

    const isFirstContact = history.length === 0;

    // Variáveis disponíveis para substituição no prompt customizado
    const vars: Record<string, string> = {
      '{business_name}': businessInfo.business_name,
      '{bot_name}': botConfig?.bot_name ?? businessInfo.business_name,
      '{phone}': phone,
      '{services}': this.formatServices(businessInfo.services),
      '{schedule}': this.formatSchedule(businessInfo.schedule),
      '{location}': businessInfo.location,
      '{conversation_history}': conversationHistory,
    };

    // Se custom_system_prompt preenchido → usar diretamente com substituição de variáveis
    if (botConfig?.custom_system_prompt) {
      let prompt = botConfig.custom_system_prompt;
      for (const [key, value] of Object.entries(vars)) {
        prompt = prompt.split(key).join(value);
      }
      return prompt;
    }

    // Construir prompt padrão usando configurações do botConfig
    const botName = botConfig?.bot_name || businessInfo.business_name;
    const personality = botConfig?.bot_personality ?? 'friendly';
    const greetingMsg = botConfig?.greeting_message ?? '';
    const unavailableMsg = botConfig?.unavailable_message ?? '';
    const confirmationMsg = botConfig?.confirmation_message ?? '';
    const autoBook = botConfig?.auto_book_if_available ?? true;
    const alwaysConfirm = botConfig?.always_confirm_booking ?? false;
    const askAdditional = botConfig?.ask_for_additional_info ?? false;

    const personalityInstructions = this.getPersonalityInstructions(personality);

    return `═══════════════════════════════════════════
IDENTIDADE
═══════════════════════════════════════════
Você se chama: ${botName}
Você representa: ${businessInfo.business_name}
⚠️ SEMPRE se apresente como "${botName}" — NUNCA use outro nome.

═══════════════════════════════════════════
PERSONALIDADE
═══════════════════════════════════════════
${personalityInstructions}

═══════════════════════════════════════════
IDIOMA E CLIENTE
═══════════════════════════════════════════
Detecte o idioma da mensagem e responda NO MESMO IDIOMA.
Número do cliente: ${phone} — NUNCA peça o telefone, você já tem.

═══════════════════════════════════════════
APRESENTAÇÃO — REGRA CRÍTICA
═══════════════════════════════════════════
${isFirstContact && greetingMsg
        ? `Esta é a PRIMEIRA mensagem. Use EXATAMENTE:\n"${greetingMsg}"\n\n⚠️ NÃO se apresente novamente nas mensagens seguintes.`
        : isFirstContact
          ? `Primeira mensagem: apresente-se como ${botName} UMA VEZ e pergunte como pode ajudar.\n\n⚠️ Nas mensagens seguintes, NÃO repita a apresentação.`
          : `⚠️ HISTÓRICO JÁ EXISTE — você JÁ se apresentou. NÃO repita nome, NÃO repita saudação. Continue a conversa diretamente.`
      }

═══════════════════════════════════════════
HISTÓRICO DA CONVERSA
═══════════════════════════════════════════
${conversationHistory}

═══════════════════════════════════════════
REGRAS DE COMPORTAMENTO
═══════════════════════════════════════════
1. HISTÓRICO: Se cliente já disse o nome → USE, não peça de novo. Continue naturalmente.
2. RECORRENTE: ❌ "Bem-vindo! Nossos serviços são..." ✅ "Oi [Nome]! Como posso ajudar?"
3. ${autoBook
        ? 'AGENDAMENTO: Use create_appointment DIRETAMENTE quando tiver todos os dados.'
        : 'AGENDAMENTO: Pergunte confirmação antes de usar create_appointment.'}
4. ${alwaysConfirm
        ? 'CONFIRMAÇÃO OBRIGATÓRIA: Antes de usar create_appointment, pergunte "Confirma o agendamento?"'
        : 'CONFIRMAÇÃO: Após coletar nome, serviço, data e horário, use create_appointment imediatamente.'}
5. ${askAdditional
        ? 'INFORMAÇÕES: Pergunte sobre preferências, sensibilidades e observações do cliente.'
        : 'INFORMAÇÕES: Colete apenas o essencial — não prolongue desnecessariamente.'}
6. NUNCA diga "te envio confirmação" — esta mensagem JÁ É a confirmação.
7. SERVIÇO A DOMICÍLIO: Se o serviço tiver "[A domicílio]" ou "[Salão ou domicílio]", pergunte o endereço completo do cliente antes de criar o agendamento. Passe service_location="at_home" e customer_address no create_appointment.
${unavailableMsg ? `8. QUANDO INDISPONÍVEL: ${unavailableMsg}` : ''}

═══════════════════════════════════════════
AGENDAMENTO REAL — OBRIGATÓRIO
═══════════════════════════════════════════
Quando tiver nome completo, serviço, data e horário confirmados:
→ Use a ferramenta create_appointment para criar o agendamento REAL no sistema.
→ CONFIRME ao cliente APENAS se a ferramenta retornar success: true.
→ Se retornar erro, informe: "Houve um problema técnico. Por favor, entre em contato."
→ ⚠️ NUNCA diga "Agendado!" sem a ferramenta ter retornado sucesso.

═══════════════════════════════════════════
INFORMAÇÕES DO NEGÓCIO
═══════════════════════════════════════════
- Nome: ${businessInfo.business_name}
- Descrição: ${businessInfo.description}
- Serviços: ${this.formatServices(businessInfo.services)}
- Horário: ${this.formatSchedule(businessInfo.schedule)}
- Localização: ${businessInfo.location}
${businessInfo.ai_instructions ? `\nINSTRUÇÕES PERSONALIZADAS:\n${businessInfo.ai_instructions}` : ''}

═══════════════════════════════════════════
FORMATO DE CONFIRMAÇÃO (após create_appointment com sucesso)
═══════════════════════════════════════════
${confirmationMsg || `"Agendado [Nome]! ✅\n[Data] [Hora] - [Serviço] €[Preço]\nNos vemos! 💅"`}`;
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

    // 2. Histórico: Redis primeiro, Supabase como fallback
    const cacheKey = `${businessId}_${phone}`;
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    const redisHistory = await ConversationCache.getHistory(cacheKey);

    if (redisHistory.length > 0) {
      // Redis tem dados — usar diretamente (mais rápido)
      history = redisHistory.map(m => ({ role: m.role, content: m.content }));
    } else {
      // Redis vazio — buscar no Supabase e popular Redis
      console.log('📊 Redis vazio, buscando histórico no Supabase para conversa', conversation.id);
      const { data: messages } = await this.supabase
        .from('whatsapp_messages')
        .select('direction, content, sent_at')
        .eq('conversation_id', conversation.id)
        .order('sent_at', { ascending: false })
        .limit(20);

      console.log('📊 Supabase: encontradas', messages?.length ?? 0, 'mensagens');

      history = (messages ?? [])
        .reverse()
        .map((m) => ({
          role: m.direction === 'inbound' ? 'user' : 'assistant',
          content: m.content,
        }));

      if (history.length > 0) {
        // Popular Redis com dados do banco
        ConversationCache.addMessages(
          cacheKey,
          history.map((m, i) => ({
            ...m,
            timestamp: Date.now() - (history.length - i) * 1000,
          }))
        ).catch(() => {});
        console.log('💾 Redis populado com', history.length, 'mensagens do Supabase');
      }
    }

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
          status: 'received',
          sent_at: now,
        },
        {
          conversation_id: conversationId,
          direction: 'outbound',
          content: botResponse,
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
