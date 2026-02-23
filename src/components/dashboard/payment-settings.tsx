'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Check, Info } from 'lucide-react';

interface PaymentSettingsProps {
  requireDeposit: boolean;
  depositType: 'percentage' | 'fixed' | null;
  depositValue: number | null;
  currency: string;
}

export function PaymentSettings({
  requireDeposit: initialRequireDeposit,
  depositType: initialDepositType,
  depositValue: initialDepositValue,
  currency,
}: PaymentSettingsProps) {
  const [requireDeposit, setRequireDeposit] = useState(initialRequireDeposit);
  const [depositType, setDepositType] = useState<'percentage' | 'fixed'>(
    initialDepositType ?? 'percentage'
  );
  const [depositValue, setDepositValue] = useState(
    initialDepositValue != null ? String(initialDepositValue) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencySymbols: Record<string, string> = {
    EUR: '€',
    GBP: '£',
    USD: '$',
    BRL: 'R$',
  };
  const sym = currencySymbols[currency] ?? currency;

  async function handleSave() {
    setError(null);
    setSaving(true);

    const parsed = parseFloat(depositValue);
    if (requireDeposit) {
      if (!depositValue || isNaN(parsed) || parsed <= 0) {
        setError('Informe um valor válido para o sinal.');
        setSaving(false);
        return;
      }
      if (depositType === 'percentage' && parsed > 100) {
        setError('A percentagem não pode exceder 100%.');
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/settings/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          require_deposit: requireDeposit,
          deposit_type: requireDeposit ? depositType : undefined,
          deposit_value: requireDeposit ? parsed : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar configurações.');
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Erro de rede. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sinal de Reserva</CardTitle>
        <CardDescription>
          Exija um pagamento antecipado ao confirmar agendamentos online.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Exigir sinal ao agendar</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              O cliente paga o sinal antes do agendamento ser confirmado
            </p>
          </div>
          <Switch
            checked={requireDeposit}
            onCheckedChange={(v) => {
              setRequireDeposit(v);
              setError(null);
            }}
          />
        </div>

        {requireDeposit && (
          <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
            <div className="space-y-2">
              <Label>Tipo de sinal</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDepositType('percentage')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    depositType === 'percentage'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  Percentagem (%)
                </button>
                <button
                  type="button"
                  onClick={() => setDepositType('fixed')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    depositType === 'fixed'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  Valor fixo ({sym})
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="depositValue">
                {depositType === 'percentage' ? 'Percentagem do serviço' : `Valor fixo (${sym})`}
              </Label>
              <div className="relative">
                <Input
                  id="depositValue"
                  type="number"
                  min="0"
                  max={depositType === 'percentage' ? '100' : undefined}
                  step="0.01"
                  value={depositValue}
                  onChange={(e) => setDepositValue(e.target.value)}
                  placeholder={depositType === 'percentage' ? 'Ex: 30' : 'Ex: 20'}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {depositType === 'percentage' ? '%' : sym}
                </span>
              </div>
              {depositType === 'percentage' && depositValue && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Para um serviço de {sym}50 → sinal de {sym}
                  {(50 * (parseFloat(depositValue) || 0) / 100).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        )}

        {!requireDeposit && (
          <p className="text-sm text-muted-foreground">
            Agendamentos são confirmados sem pagamento prévio.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? 'Guardado!' : 'Guardar configurações'}
        </Button>
      </CardContent>
    </Card>
  );
}
