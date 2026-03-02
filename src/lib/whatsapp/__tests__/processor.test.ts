import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('@/lib/ai/chatbot', () => {
  return {
    AIBot: class MockAIBot {
      processMessage = vi.fn().mockResolvedValue('Bot response');
    },
  };
});

vi.mock('@/lib/whatsapp/client', () => ({
  WhatsAppClient: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn().mockResolvedValue(undefined),
    markAsRead: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/whatsapp/evolution', () => ({
  sendEvolutionMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/redis/conversation-cache', () => ({
  ConversationCache: {
    acquireGreetingLock: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/whatsapp/rate-limiter', () => ({
  WhatsAppRateLimiter: {
    checkAndIncrement: vi.fn().mockResolvedValue({ allowed: true, remaining: { hour: 29, day: 49, week: 199 } }),
  },
}));

// Mock supabase
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { processWhatsAppMessage } from '@/lib/whatsapp/processor';
import { ConversationCache } from '@/lib/redis/conversation-cache';
import { WhatsAppRateLimiter } from '@/lib/whatsapp/rate-limiter';
import { sendEvolutionMessage } from '@/lib/whatsapp/evolution';

// Create a chainable mock that returns data at terminal calls
function chainable(data: unknown) {
  const chain: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => Promise.resolve({ data });
      }
      // All other methods return the proxy itself (eq, or, select, etc.)
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy(chain, handler);
}

// Helper to setup supabase mock chain
function setupMockChain(configs: {
  whatsappConfig?: Record<string, unknown> | null;
  professional?: { id: string } | null;
  contact?: { use_bot: boolean } | null;
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'whatsapp_config') return chainable(configs.whatsappConfig);
    if (table === 'professionals') return chainable(configs.professional);
    if (table === 'contacts') return chainable(configs.contact);
    return chainable(null);
  });
}

describe('processWhatsAppMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ConversationCache.acquireGreetingLock as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (WhatsAppRateLimiter.checkAndIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      remaining: { hour: 29, day: 49, week: 199 },
    });
  });

  it('skips duplicate messages', async () => {
    (ConversationCache.acquireGreetingLock as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await processWhatsAppMessage('+5511999999999', 'oi', 'msg-123', 'evolution', 'inst-1');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns early when no active config found', async () => {
    setupMockChain({ whatsappConfig: null });

    await processWhatsAppMessage('+5511999999999', 'oi', 'msg-456', 'evolution', 'inst-1');

    expect(sendEvolutionMessage).not.toHaveBeenCalled();
  });

  it('returns early when bot_enabled is false', async () => {
    setupMockChain({
      whatsappConfig: {
        id: 'cfg-1',
        user_id: 'user-1',
        is_active: true,
        bot_enabled: false,
        provider: 'evolution',
        evolution_api_url: 'https://evo.test',
        evolution_api_key: 'key-1',
        evolution_instance: 'inst-1',
      },
    });

    await processWhatsAppMessage('+5511999999999', 'oi', 'msg-789', 'evolution', 'inst-1');

    expect(sendEvolutionMessage).not.toHaveBeenCalled();
  });

  it('returns early when contact has use_bot=false', async () => {
    setupMockChain({
      whatsappConfig: {
        id: 'cfg-1',
        user_id: 'user-1',
        is_active: true,
        bot_enabled: true,
        provider: 'evolution',
        evolution_api_url: 'https://evo.test',
        evolution_api_key: 'key-1',
        evolution_instance: 'inst-1',
      },
      professional: { id: 'prof-1' },
      contact: { use_bot: false },
    });

    await processWhatsAppMessage('+5511999999999', 'oi', 'msg-aaa', 'evolution', 'inst-1');

    expect(sendEvolutionMessage).not.toHaveBeenCalled();
  });

  it('returns early when rate limited', async () => {
    (WhatsAppRateLimiter.checkAndIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      reason: 'Limite de 30 mensagens por hora atingido.',
      remaining: { hour: 0, day: 20, week: 170 },
    });

    setupMockChain({
      whatsappConfig: {
        id: 'cfg-1',
        user_id: 'user-1',
        is_active: true,
        bot_enabled: true,
        provider: 'evolution',
        evolution_api_url: 'https://evo.test',
        evolution_api_key: 'key-1',
        evolution_instance: 'inst-1',
      },
      professional: { id: 'prof-1' },
      contact: null,
    });

    await processWhatsAppMessage('+5511999999999', 'oi', 'msg-bbb', 'evolution', 'inst-1');

    expect(sendEvolutionMessage).not.toHaveBeenCalled();
  });

  it('sends message and increments rate limiter on success', async () => {
    setupMockChain({
      whatsappConfig: {
        id: 'cfg-1',
        user_id: 'user-1',
        is_active: true,
        bot_enabled: true,
        provider: 'evolution',
        evolution_api_url: 'https://evo.test',
        evolution_api_key: 'key-1',
        evolution_instance: 'inst-1',
      },
      professional: { id: 'prof-1' },
      contact: null,
    });

    await processWhatsAppMessage('+5511999999999', 'oi', 'msg-ccc', 'evolution', 'inst-1');

    expect(sendEvolutionMessage).toHaveBeenCalledWith(
      '+5511999999999',
      'Bot response',
      {
        apiUrl: 'https://evo.test',
        apiKey: 'key-1',
        instance: 'inst-1',
      }
    );
    expect(WhatsAppRateLimiter.checkAndIncrement).toHaveBeenCalledWith('prof-1');
  });
});
