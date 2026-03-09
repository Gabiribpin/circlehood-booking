'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleHoodLogoFull } from '@/components/branding/logo';
import { Mail, RefreshCw, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

export default function VerifyEmailPendingPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleResend() {
    setResending(true);
    setResendStatus('idle');
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/resend-verification-email', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setResendStatus('error');
        setErrorMsg(data.error || t('verifyEmailResendError'));
      } else {
        setResendStatus('sent');
      }
    } catch {
      setResendStatus('error');
      setErrorMsg(t('connectionError'));
    } finally {
      setResending(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const steps = [
    t('verifyEmailStep1'),
    t('verifyEmailStep2'),
    t('verifyEmailStep3'),
    t('verifyEmailStep4'),
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <CircleHoodLogoFull />
          </div>
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center">
              <Mail className="h-8 w-8 text-amber-500" />
            </div>
          </div>
          <CardTitle className="text-xl">{t('verifyEmailTitle')}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {t('verifyEmailDesc')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Steps */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">{t('verifyEmailHowTo')}</p>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Resend status */}
          {resendStatus === 'sent' && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {t('verifyEmailResent')}
            </div>
          )}

          {resendStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleResend}
              disabled={resending}
              variant="outline"
              className="w-full"
            >
              {resending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('verifyEmailResendBtn')}
            </Button>

            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('verifyEmailLogoutBtn')}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {t('verifyEmailSpamTip')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
