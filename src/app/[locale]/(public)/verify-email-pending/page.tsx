'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleHoodLogoFull } from '@/components/branding/logo';
import { Mail, RefreshCw, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

export default function VerifyEmailPendingPage() {
  const router = useRouter();
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
        setErrorMsg(data.error || 'Erro ao reenviar. Tente novamente.');
      } else {
        setResendStatus('sent');
      }
    } catch {
      setResendStatus('error');
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setResending(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

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
          <CardTitle className="text-xl">Confirme seu email</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Enviamos um link de confirmação para o seu email.
            Clique no link para ativar sua conta e acessar o painel.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Steps */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Como confirmar:</p>
            <ol className="space-y-2">
              {[
                'Abra sua caixa de entrada',
                'Procure o email de "CircleHood Booking"',
                'Clique em "Confirmar Email"',
                'Volte aqui e faça login',
              ].map((step, i) => (
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
              Novo link enviado! Verifique sua caixa de entrada.
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
              Reenviar email de confirmação
            </Button>

            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair da conta
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Não recebeu o email? Verifique a pasta de spam ou clique em &ldquo;Reenviar&rdquo; acima.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
