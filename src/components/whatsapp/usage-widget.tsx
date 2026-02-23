'use client';

import { useEffect, useState } from 'react';

interface UsageStats {
  hour: { count: number; limit: number; remaining: number };
  day: { count: number; limit: number; remaining: number };
}

export function WhatsAppUsageWidget() {
  const [stats, setStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/whatsapp/stats');
        if (!res.ok) return;
        const data = await res.json();
        setStats(data);
      } catch {
        // silencioso — widget é opcional
      }
    }

    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const dayPercentage = (stats.day.count / stats.day.limit) * 100;
  const isWarning = dayPercentage >= 70;
  const isDanger = dayPercentage >= 90;

  return (
    <div
      className={`p-4 rounded-lg border text-sm ${
        isDanger
          ? 'bg-red-50 border-red-200'
          : isWarning
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-blue-50 border-blue-200'
      }`}
    >
      <p className="font-semibold mb-2">📱 Uso WhatsApp (hoje)</p>

      <div className="flex justify-between mb-1">
        <span className="text-muted-foreground">Mensagens:</span>
        <span className="font-medium">
          {stats.day.count} / {stats.day.limit}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
        <div
          className={`h-1.5 rounded-full transition-all ${
            isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(dayPercentage, 100)}%` }}
        />
      </div>

      {isDanger && (
        <p className="text-red-700 text-xs">
          🚨 Limite quase atingido. Evite enviar mais hoje.
        </p>
      )}
      {isWarning && !isDanger && (
        <p className="text-yellow-700 text-xs">
          ⚠️ Próximo do limite. Use com moderação.
        </p>
      )}
      {!isWarning && (
        <p className="text-xs text-muted-foreground">
          Bot conversacional não conta neste limite.
        </p>
      )}
    </div>
  );
}
