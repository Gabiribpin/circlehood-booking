'use client';

import { useState } from 'react';
import { Clock, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface TrialExpirationBannerProps {
  daysRemaining: number;
  trialEndsAt: string; // ISO string
}

export function TrialExpirationBanner({ daysRemaining, trialEndsAt }: TrialExpirationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const endDate = new Date(trialEndsAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const isUrgent = daysRemaining <= 1;
  const isAlert = daysRemaining <= 3 && daysRemaining > 1;
  // else: warning (7 days)

  const styles = isUrgent
    ? {
        wrapper: 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-700',
        text: 'text-red-800 dark:text-red-200',
        subtext: 'text-red-700 dark:text-red-300',
        btn: 'bg-red-600 hover:bg-red-700 text-white border-0',
        close: 'text-red-500 hover:text-red-800',
        icon: <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />,
      }
    : isAlert
    ? {
        wrapper: 'border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700',
        text: 'text-orange-800 dark:text-orange-200',
        subtext: 'text-orange-700 dark:text-orange-300',
        btn: 'bg-orange-500 hover:bg-orange-600 text-white border-0',
        close: 'text-orange-500 hover:text-orange-800',
        icon: <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />,
      }
    : {
        wrapper: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-700',
        text: 'text-yellow-800 dark:text-yellow-200',
        subtext: 'text-yellow-700 dark:text-yellow-300',
        btn: 'bg-yellow-500 hover:bg-yellow-600 text-white border-0',
        close: 'text-yellow-500 hover:text-yellow-800',
        icon: <Clock className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />,
      };

  const title = isUrgent
    ? '🚨 Seu período de teste expira amanhã!'
    : isAlert
    ? `⚠️ Seu período de teste expira em ${daysRemaining} dias!`
    : `🕐 Seu período de teste expira em ${daysRemaining} dias`;

  const description = isUrgent
    ? `Sua página pública será desativada em 24 horas (${endDate}). Assine agora para não perder nenhum agendamento.`
    : isAlert
    ? `Sua página pública e agendamentos serão pausados em ${daysRemaining} dias (${endDate}).`
    : `Após ${endDate}, novos agendamentos serão bloqueados. Assine o Plano Pro para continuar.`;

  const consequences = isUrgent
    ? ['Página pública desativada', 'Agendamentos bloqueados', 'Bot do WhatsApp pausado']
    : null;

  return (
    <div className={`relative rounded-lg border px-4 py-3 mb-2 ${styles.wrapper}`}>
      <button
        onClick={() => setDismissed(true)}
        className={`absolute top-2 right-2 ${styles.close}`}
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        {styles.icon}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${styles.text}`}>{title}</p>
          <p className={`text-xs mt-0.5 ${styles.subtext}`}>{description}</p>

          {consequences && (
            <ul className={`text-xs mt-1.5 space-y-0.5 ${styles.subtext}`}>
              {consequences.map((c) => (
                <li key={c} className="flex items-center gap-1">
                  <span className="text-[10px]">•</span> {c}
                </li>
              ))}
            </ul>
          )}

          <Button
            size="sm"
            asChild
            className={`mt-2 h-7 text-xs ${styles.btn}`}
          >
            <Link href="/settings/payment">
              Assinar Plano Pro
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
