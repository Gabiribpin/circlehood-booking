import Anthropic from '@anthropic-ai/sdk';

// ─── CircleHood Booking FAQ for bot context ──────────────────────────────────

const CIRCLEHOOD_FAQ = `
CircleHood Booking — FAQ para suporte pós-venda (SaaS):

1. CONECTAR WHATSAPP:
   - Menu "WhatsApp Bot" → inserir número → clicar "Conectar WhatsApp"
   - Escanear o QR Code com o WhatsApp no smartphone
   - O WhatsApp fica conectado como dispositivo vinculado (semelhante ao WhatsApp Web)
   - Após conectar, o bot responde agendamentos automaticamente

2. ADICIONAR/GERENCIAR SERVIÇOS:
   - Menu "Serviços" → "Novo Serviço"
   - Preencher: nome, preço, duração em minutos
   - Ativar ou desativar serviços a qualquer momento sem deletar

3. CONFIGURAR HORÁRIOS DE ATENDIMENTO:
   - Menu "Horários" → selecionar dias da semana e horários de abertura/fechamento
   - Os clientes só veem slots disponíveis com base nos horários configurados

4. VISUALIZAR E GERENCIAR AGENDAMENTOS:
   - Menu "Agendamentos" mostra todos os agendamentos
   - Filtros por data, status (confirmado/cancelado/concluído) e cliente
   - Possível cancelar ou marcar como concluído pelo painel

5. ANALYTICS E RELATÓRIOS:
   - Menu "Análises" mostra receita, agendamentos, clientes únicos e ticket médio
   - Filtros por período: hoje, últimos 7/30 dias, ano, período customizado

6. PERSONALIZAR A PÁGINA PÚBLICA:
   - "Editor de Página": cores, bio, título e logo
   - "Galeria": fotos dos trabalhos organizadas por categoria
   - "Depoimentos": avaliações de clientes exibidas na página pública
   - Link da página pública: https://circlehood-booking.vercel.app/[seu-slug]

7. PLANO E COBRANÇA:
   - Período de teste: 14 dias gratuito, sem cartão de crédito
   - Para assinar: Configurações → Pagamentos → Assinar Plano Pro
   - Pagamentos processados pelo Stripe (seguro e certificado PCI)
   - Cancelar a qualquer momento pelo portal do Stripe

8. MARKETING:
   - Menu "Marketing": gerar QR Codes, cartões de visita digitais, posts para redes sociais
   - Compartilhar link de agendamento via WhatsApp, Instagram e Facebook

9. NOTIFICAÇÕES:
   - Menu "Notificações": configurar lembretes automáticos para clientes
   - Suporte a email e WhatsApp para confirmações e lembretes

10. PROBLEMAS TÉCNICOS COMUNS:
    - QR Code não aparece: recarregar a página e tentar novamente
    - Bot não responde: verificar se a sessão WhatsApp está ativa no menu WhatsApp Bot
    - Não consigo fazer login: usar "Esqueci minha senha" na tela de login
    - Agendamento não aparece: verificar timezone nas configurações
`;

export interface SupportBotResponse {
  message: string;
  shouldEscalate: boolean;
}

/**
 * Generates an AI response for a SaaS support ticket.
 * Returns shouldEscalate=true when the bot can't confidently answer
 * or the topic requires access to account-specific data.
 */
export async function generateSupportResponse(
  subject: string,
  userMessage: string
): Promise<SupportBotResponse> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Você é o assistente de suporte do CircleHood Booking — um SaaS de agendamentos para profissionais autônomos de qualquer área que trabalham com hora marcada.

Responda em português brasileiro, de forma amigável e clara.
Use a FAQ abaixo para responder dúvidas comuns.

REGRAS:
- Se puder responder com base na FAQ: dê a resposta completa e útil.
- Se a pergunta requer acesso à conta específica do usuário (dados, faturamento, bugs técnicos específicos): responda ESCALAR.
- Se o assunto for crítico/urgente/reclamação séria: responda ESCALAR.
- Nunca invente informações. Seja conciso (máximo 3 parágrafos).
- Não mencione "FAQ" ou "base de conhecimento" na resposta.

${CIRCLEHOOD_FAQ}`,
      messages: [
        {
          role: 'user',
          content: `Assunto: ${subject}\n\nMensagem: ${userMessage}`,
        },
      ],
    });

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    const shouldEscalate =
      text.startsWith('ESCALAR') ||
      text.toUpperCase().includes('ESCALAR') ||
      text.length < 20;

    if (shouldEscalate) {
      return {
        message:
          '🤖 Entendido! Sua dúvida foi encaminhada para nossa equipe de suporte, que analisará e responderá em breve. Obrigado pela paciência! ⏱️',
        shouldEscalate: true,
      };
    }

    return { message: text, shouldEscalate: false };
  } catch (err) {
    console.error('[support-bot] Error:', err);
    // On error: escalate gracefully
    return {
      message:
        '🤖 Recebemos seu chamado! Nossa equipe entrará em contato em breve.',
      shouldEscalate: true,
    };
  }
}

/**
 * Handles an incoming WhatsApp message from a SaaS customer.
 * Returns the response text to send back, and whether to create a ticket.
 */
export async function handleWhatsAppSupportMessage(
  message: string,
  senderName: string
): Promise<{ reply: string; createTicket: boolean; ticketSubject: string }> {
  // Build a short subject from the message
  const ticketSubject =
    message.length > 60 ? message.substring(0, 57) + '...' : message;

  const botResponse = await generateSupportResponse('Mensagem via WhatsApp', message);

  if (botResponse.shouldEscalate) {
    return {
      reply: `Olá ${senderName}! 👋 Recebemos sua mensagem e criamos um chamado de suporte para você. Nossa equipe responderá em breve pelo painel ou por e-mail.\n\nSe preferir, também pode acessar *Suporte* no seu dashboard. ✅`,
      createTicket: true,
      ticketSubject,
    };
  }

  return {
    reply: botResponse.message,
    createTicket: false,
    ticketSubject,
  };
}
