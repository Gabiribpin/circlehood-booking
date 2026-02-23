/**
 * WhatsApp Rate Limiter
 *
 * Limites por profissional para proteção contra ban:
 *   - 30 mensagens/hora
 *   - 50 mensagens/dia
 *   - 200 mensagens/semana
 *
 * NOTA: Respostas conversacionais do bot (cliente inicia → bot responde)
 * NÃO contam neste limite — apenas mensagens proativas (confirmações, etc.).
 *
 * Implementação in-memory com chave por profissional.
 * Em produção com múltiplas instâncias, migrar para Redis.
 */

interface BucketEntry {
  count: number;
  resetAt: number; // Unix timestamp ms
}

const LIMITS = {
  PER_HOUR: 30,
  PER_DAY: 50,
  PER_WEEK: 200,
} as const;

// In-memory store: chave = `{professionalId}:{bucket}:{period}`
const store = new Map<string, BucketEntry>();

function getOrCreate(key: string, ttlMs: number): BucketEntry {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.resetAt > now) return entry;
  const fresh: BucketEntry = { count: 0, resetAt: now + ttlMs };
  store.set(key, fresh);
  return fresh;
}

function periodKeys(professionalId: string) {
  const now = new Date();

  // Hora: bucket por hora do dia
  const hourBucket = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  // Dia: bucket por dia UTC
  const dayBucket = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  // Semana: bucket por semana ISO
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());
  const weekBucket = weekStart.toISOString().split('T')[0];

  const msInHour = 60 * 60 * 1_000;
  const msInDay = 24 * msInHour;
  const msInWeek = 7 * msInDay;

  return {
    hour: { key: `${professionalId}:hour:${hourBucket}`, ttl: msInHour },
    day:  { key: `${professionalId}:day:${dayBucket}`,   ttl: msInDay  },
    week: { key: `${professionalId}:week:${weekBucket}`, ttl: msInWeek },
  };
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining: {
    hour: number;
    day: number;
    week: number;
  };
}

export const WhatsAppRateLimiter = {
  check(professionalId: string): RateLimitResult {
    const periods = periodKeys(professionalId);

    const hourEntry = getOrCreate(periods.hour.key, periods.hour.ttl);
    const dayEntry  = getOrCreate(periods.day.key,  periods.day.ttl);
    const weekEntry = getOrCreate(periods.week.key, periods.week.ttl);

    const remaining = {
      hour: Math.max(0, LIMITS.PER_HOUR - hourEntry.count),
      day:  Math.max(0, LIMITS.PER_DAY  - dayEntry.count),
      week: Math.max(0, LIMITS.PER_WEEK - weekEntry.count),
    };

    if (hourEntry.count >= LIMITS.PER_HOUR) {
      return {
        allowed: false,
        reason: `Limite de ${LIMITS.PER_HOUR} mensagens por hora atingido. Aguarde antes de enviar mais.`,
        remaining,
      };
    }

    if (dayEntry.count >= LIMITS.PER_DAY) {
      return {
        allowed: false,
        reason: `Limite de ${LIMITS.PER_DAY} mensagens por dia atingido. Este limite protege o seu número contra bloqueio.`,
        remaining,
      };
    }

    if (weekEntry.count >= LIMITS.PER_WEEK) {
      return {
        allowed: false,
        reason: `Limite de ${LIMITS.PER_WEEK} mensagens por semana atingido.`,
        remaining,
      };
    }

    return { allowed: true, remaining };
  },

  increment(professionalId: string): void {
    const periods = periodKeys(professionalId);
    for (const { key, ttl } of Object.values(periods)) {
      const entry = getOrCreate(key, ttl);
      entry.count++;
      store.set(key, entry);
    }
    // Limpeza de entradas expiradas (lazy)
    this._cleanup();
  },

  getStats(professionalId: string) {
    const periods = periodKeys(professionalId);

    const hourEntry = getOrCreate(periods.hour.key, periods.hour.ttl);
    const dayEntry  = getOrCreate(periods.day.key,  periods.day.ttl);
    const weekEntry = getOrCreate(periods.week.key, periods.week.ttl);

    return {
      hour: {
        count:     hourEntry.count,
        limit:     LIMITS.PER_HOUR,
        remaining: Math.max(0, LIMITS.PER_HOUR - hourEntry.count),
      },
      day: {
        count:     dayEntry.count,
        limit:     LIMITS.PER_DAY,
        remaining: Math.max(0, LIMITS.PER_DAY - dayEntry.count),
      },
      week: {
        count:     weekEntry.count,
        limit:     LIMITS.PER_WEEK,
        remaining: Math.max(0, LIMITS.PER_WEEK - weekEntry.count),
      },
    };
  },

  _cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  },
};
