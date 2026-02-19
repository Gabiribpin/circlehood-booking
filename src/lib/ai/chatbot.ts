import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { detectLanguage } from './language-detector';
import { classifyIntent } from './intent-classifier';

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
    // 1. Buscar contexto do usuário
    const context = await this.getConversationContext(phone, businessId);

    // 2. Usar idioma salvo ou 'pt' como padrão (o prompt detecta dinamicamente)
    if (!context.language) {
      context.language = 'pt';
    }

    // 3. Classificar intenção
    const intent = await classifyIntent(message, context.language);

    // 4. Gerar resposta baseada na intenção
    console.log('🤖 Chamando Anthropic para', phone, '| intent:', intent, '| history:', context.history.length);
    const response = await this.generateResponse(message, intent, context);
    console.log('✅ Anthropic respondeu para', phone);

    // 5. Salvar no histórico (usar conversationId já carregado, sem lookup extra)
    await this.saveToHistory(context.conversationId, message, response);

    return response;
  }

  private async generateResponse(
    message: string,
    intent: string,
    context: ConversationContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...context.history,
        { role: 'user', content: message }
      ]
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }

  private buildSystemPrompt(context: ConversationContext): string {
    const { businessInfo, language, phone, history } = context;

    console.log('📝 Contexto sendo passado:', {
      phone,
      language,
      historyLength: history.length,
      historyPreview: history.slice(0, 2),
    });

    const conversationHistory = history.length > 0
      ? history.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n')
      : '(sem histórico anterior)';

    return `Você é um assistente virtual inteligente para ${businessInfo.business_name}.

IDIOMA: Detecte o idioma da mensagem e responda NO MESMO IDIOMA.

NÚMERO DO CLIENTE: ${phone}
⚠️ NUNCA peça o telefone — você já tem: ${phone}

═══════════════════════════════════════════
HISTÓRICO DA CONVERSA:
${conversationHistory}
═══════════════════════════════════════════

REGRAS DE COMPORTAMENTO INTELIGENTE:

1. USE O HISTÓRICO OBRIGATORIAMENTE:
   - Cliente já disse o nome? → USE o nome, não peça de novo
   - Cliente já tem agendamento? → MENCIONE ao cumprimentar
   - Cliente já conhece serviços? → NÃO liste tudo de novo
   - Continue a conversa naturalmente, nunca recomece do zero

2. RECONHEÇA CLIENTE RECORRENTE:
   ❌ ERRADO: "Bem-vindo! Nossos serviços são..."
   ✅ CORRETO: "Oi [Nome]! Tudo bem? Posso ajudar com algo?"

3. AGENDAMENTO DIRETO — sem enrolação:
   ❌ "Deixe-me verificar a disponibilidade..."
   ✅ "Perfeito! Agendado para [Data] às [Hora]!"
   Não existe "verificar" — confirme diretamente.

4. NUNCA diga "te envio confirmação" — a mensagem JÁ É a confirmação.

INFORMAÇÕES DO NEGÓCIO:
- Nome: ${businessInfo.business_name}
- Descrição: ${businessInfo.description}
- Serviços: ${this.formatServices(businessInfo.services)}
- Horário: ${this.formatSchedule(businessInfo.schedule)}
- Localização: ${businessInfo.location}

${businessInfo.ai_instructions ? `INSTRUÇÕES PERSONALIZADAS:\n${businessInfo.ai_instructions}` : ''}

FORMATO DE AGENDAMENTO:
Colete: nome completo, serviço, data e horário.
Confirme com:
"Agendado [Nome]! ✅
[Data] [Hora] - [Serviço] €[Preço]
Nos vemos! 💅"`;
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
    return services.map(s =>
      `- ${s.name}: €${s.price}${s.duration ? ` (${s.duration}min)` : ''}`
    ).join('\n');
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

    // 2. Buscar últimas 10 mensagens (mais antigas primeiro para contexto)
    console.log('🔍 DEBUG: Buscando histórico para', phone, '| conversa:', conversation.id);
    const { data: messages } = await this.supabase
      .from('whatsapp_messages')
      .select('direction, content')
      .eq('conversation_id', conversation.id)
      .order('sent_at', { ascending: false })
      .limit(10);

    console.log('📊 Mensagens encontradas:', messages?.length ?? 0);
    if (messages && messages.length > 0) {
      console.log('💬 Últimas mensagens:', messages.map(m => `${m.direction}: ${m.content.substring(0, 50)}`));
    }

    const history: Array<{ role: 'user' | 'assistant'; content: string }> = (
      messages ?? []
    )
      .reverse()
      .map((m) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content,
      }));

    // 3. Buscar info do negócio (professional + services + working_hours)
    const { data: professional } = await this.supabase
      .from('professionals')
      .select('id, business_name, bio, city')
      .eq('user_id', businessId)
      .single();

    const { data: services } = await this.supabase
      .from('services')
      .select('name, price, duration_minutes')
      .eq('professional_id', professional?.id ?? '')
      .eq('is_active', true);

    const { data: workingHours } = await this.supabase
      .from('working_hours')
      .select('day_of_week, start_time, end_time')
      .eq('professional_id', professional?.id ?? '')
      .eq('is_available', true);

    const schedule = (workingHours ?? []).reduce(
      (acc: Record<string, { start: string; end: string }>, wh) => {
        acc[wh.day_of_week] = { start: wh.start_time, end: wh.end_time };
        return acc;
      },
      {}
    );

    return {
      userId: phone,
      phone,
      conversationId: conversation.id,
      language: conversation.language ?? '',
      history,
      businessInfo: {
        business_name: professional?.business_name ?? '',
        description: professional?.bio ?? '',
        services: services ?? [],
        schedule,
        location: professional?.city ?? '',
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
