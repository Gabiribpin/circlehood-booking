'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, ExternalLink, AlertTriangle } from 'lucide-react';
import type { Professional } from '@/types/database';

interface SettingsManagerProps {
  professional: Professional;
  trialDaysLeft: number;
  trialExpired: boolean;
  success?: boolean;
  cancelled?: boolean;
}

export function SettingsManager({
  professional,
  trialDaysLeft,
  trialExpired,
  success,
  cancelled,
}: SettingsManagerProps) {
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  async function handleCheckout() {
    setLoadingCheckout(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingCheckout(false);
    }
  }

  async function handlePortal() {
    setLoadingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingPortal(false);
    }
  }

  const isActive = professional.subscription_status === 'active';
  const isTrial = professional.subscription_status === 'trial';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {success && (
        <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-700 dark:text-green-400">
              Assinatura ativada com sucesso! Obrigado por assinar o CircleHood Pro.
            </p>
          </CardContent>
        </Card>
      )}

      {cancelled && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Checkout cancelado. Você pode assinar a qualquer momento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano e assinatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge
              variant={
                isActive
                  ? 'default'
                  : isTrial && !trialExpired
                    ? 'secondary'
                    : 'destructive'
              }
            >
              {isActive
                ? 'Pro - Ativo'
                : isTrial && !trialExpired
                  ? `Teste grátis (${trialDaysLeft}d restantes)`
                  : isTrial && trialExpired
                    ? 'Teste expirado'
                    : professional.subscription_status === 'cancelled'
                      ? 'Cancelado'
                      : 'Expirado'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plano</span>
            <span className="text-sm font-medium">
              {isActive ? 'Pro' : 'Grátis'}
            </span>
          </div>

          {isTrial && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Teste termina em</span>
              <span className="text-sm">
                {new Date(professional.trial_ends_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}

          {professional.stripe_customer_id && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">ID Stripe</span>
              <span className="text-xs font-mono text-muted-foreground">
                {professional.stripe_customer_id.slice(0, 18)}...
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trial Expired Warning */}
      {trialExpired && !isActive && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                Seu período de teste expirou
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua página pública mostra um aviso e novos agendamentos estao bloqueados.
              Assine o plano Pro para continuar recebendo clientes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-6 space-y-3">
          {!isActive ? (
            <>
              <div className="text-center mb-4">
                <p className="text-2xl font-bold">&euro;25<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                <p className="text-sm text-muted-foreground mt-1">
                  Página profissional + agendamento ilimitado
                </p>
              </div>
              <Button
                onClick={handleCheckout}
                disabled={loadingCheckout}
                className="w-full gap-2"
                size="lg"
              >
                {loadingCheckout ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Assinar plano Pro
              </Button>
            </>
          ) : (
            <Button
              onClick={handlePortal}
              disabled={loadingPortal}
              variant="outline"
              className="w-full gap-2"
            >
              {loadingPortal ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Gerenciar assinatura
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Negócio</span>
            <span className="text-sm font-medium">{professional.business_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Slug</span>
            <span className="text-sm font-mono">{professional.slug}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Membro desde</span>
            <span className="text-sm">
              {new Date(professional.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
