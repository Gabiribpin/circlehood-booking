'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export function WelcomeModal() {
  const t = useTranslations('whatsapp');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('whatsapp-warning-seen');
    if (!seen) setIsOpen(true);
  }, []);

  if (!isOpen) return null;

  const handleAccept = () => {
    localStorage.setItem('whatsapp-warning-seen', 'true');
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-card rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold">{t('welcomeTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('welcomeSubtitle')}
          </p>
        </div>

        <div className="space-y-3 text-sm mb-5">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-md">
            <p className="font-semibold text-green-800 dark:text-green-400 mb-1">✅ {t('welcomeAllowed')}</p>
            <ul className="text-green-700 dark:text-green-500 space-y-0.5 pl-2">
              <li>• {t('welcomeAllowedBot')}</li>
              <li>• {t('welcomeAllowedBooking')}</li>
              <li>• {t('welcomeAllowedConfirm')}</li>
            </ul>
          </div>

          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-md">
            <p className="font-semibold text-red-800 dark:text-red-400 mb-1">❌ {t('welcomeForbidden')}</p>
            <ul className="text-red-700 dark:text-red-500 space-y-0.5 pl-2">
              <li>• {t('welcomeForbiddenMass')}</li>
              <li>• {t('welcomeForbiddenCampaigns')}</li>
              <li>• {t('welcomeForbiddenReminders')}</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t('welcomeLimit')}
          </p>
        </div>

        <Button onClick={handleAccept} className="w-full">
          {t('welcomeAccept')}
        </Button>
      </div>
    </div>
  );
}
