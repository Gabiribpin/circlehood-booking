import { logger } from '@/lib/logger';
import Redis from 'ioredis';
import { parseRedisUrl } from './parse-url';
import { redisKey } from './prefix';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const TTL = 86400; // 24 horas
const MAX_MESSAGES = 20;

// Aceita STORAGE_URL ou REDIS_URL (nomes alternativos de integração)
const REDIS_CONNECTION_URL = process.env.STORAGE_URL || process.env.REDIS_URL;
const isConfigured = !!REDIS_CONNECTION_URL;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!isConfigured) return null;
  if (redis) return redis;

  redis = new Redis({
    ...parseRedisUrl(REDIS_CONNECTION_URL!),
    maxRetriesPerRequest: 1,     // Falha rápido (não 3 tentativas lentas)
    connectTimeout: 3000,         // 3s timeout de conexão
    commandTimeout: 3000,         // 3s timeout por comando
    enableReadyCheck: false,      // Não espera READY antes de enviar comandos
    lazyConnect: true,            // Conecta só quando precisa
    retryStrategy: (times) => {
      if (times > 1) return null; // Apenas 1 retry
      return 500;
    },
  });

  redis.on('error', (err) => logger.error('❌ Redis error:', err.message));

  return redis;
}

export class ConversationCache {

  static async getHistory(cacheKey: string): Promise<ConversationMessage[]> {
    const client = getRedis();
    if (!client) {
      logger.info('⏭️ Redis não configurado — usando fallback');
      return [];
    }

    try {
      const key = redisKey(`conversation:${cacheKey}`);
      const dataStr = await client.get(key);
      if (!dataStr) return [];

      const data = JSON.parse(dataStr) as ConversationMessage[];
      logger.info('📦 Redis: carregou', data.length, 'mensagens para', cacheKey);
      return data;
    } catch (error) {
      logger.error('❌ Redis get error:', (error as Error).message);
      return [];
    }
  }

  static async addMessages(
    cacheKey: string,
    messages: ConversationMessage[]
  ): Promise<void> {
    const client = getRedis();
    if (!client) return;

    try {
      const key = redisKey(`conversation:${cacheKey}`);
      const current = await this.getHistory(cacheKey);
      const limited = [...current, ...messages].slice(-MAX_MESSAGES);
      await client.setex(key, TTL, JSON.stringify(limited));
      logger.info('✅ Redis: salvou', messages.length, 'mensagens para', cacheKey);
    } catch (error) {
      logger.error('❌ Redis set error:', (error as Error).message);
    }
  }

  static async clear(cacheKey: string): Promise<void> {
    const client = getRedis();
    if (!client) return;

    try {
      await client.del(redisKey(`conversation:${cacheKey}`));
    } catch (error) {
      logger.error('❌ Redis del error:', (error as Error).message);
    }
  }

  /**
   * Tenta adquirir lock de saudação (NX = só seta se não existir).
   * Retorna true se este processo pode enviar a saudação, false se outro já enviou.
   * TTL de 30s para auto-expirar em caso de falha.
   */
  static async acquireGreetingLock(cacheKey: string): Promise<boolean> {
    const client = getRedis();
    if (!client) return true; // sem Redis: permite (risco baixo)
    try {
      // TTL de 300s (5 min) para cobrir toda a janela de retry da Evolution/Meta
      const result = await client.set(redisKey(`greeting_lock:${cacheKey}`), '1', 'EX', 300, 'NX');
      return result === 'OK';
    } catch {
      return true; // em erro: permite
    }
  }
}
