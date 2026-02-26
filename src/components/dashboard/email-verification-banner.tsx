'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, X, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailVerificationBannerProps {
  userEmail: string;
}

/**
 * Shows a banner when the professional's email is not yet verified.
 * Allows resending the verification email.
 */
export function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
  const t = useTranslations('settings');
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  async function handleResend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-verification-email', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('emailVerifError'));
      } else {
        setSent(true);
      }
    } catch {
      setError(t('emailVerifError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-700 px-4 py-3 mb-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-200"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <Mail className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {sent ? (
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm font-medium">{t('emailVerifSent', { email: userEmail })}</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('emailVerifTitle')}
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                {t('emailVerifDesc', { email: userEmail })}
              </p>
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleResend}
                disabled={loading}
                className="mt-2 h-7 text-xs border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:text-yellow-200 dark:border-yellow-600 dark:hover:bg-yellow-900/30"
              >
                {loading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                {t('emailVerifResend')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
