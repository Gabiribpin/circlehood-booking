'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, CreditCard, Smartphone } from 'lucide-react';
import { formatIBAN } from '@/lib/validators/iban';

type Method = 'stripe_pending' | 'manual';
type Status = 'idle' | 'saving' | 'success' | 'error';

interface SimplifiedPaymentSetupProps {
  currentMethod?: string | null;
  currentKey?: string | null;
}

export function SimplifiedPaymentSetup({
  currentMethod,
  currentKey,
}: SimplifiedPaymentSetupProps) {
  const [selectedMethod, setSelectedMethod] = useState<Method>(
    currentMethod === 'manual' ? 'manual' : 'stripe_pending'
  );

  // Stripe fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [iban, setIban] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Manual field
  const [manualKey, setManualKey] = useState(currentKey || '');

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMethod, setSavedMethod] = useState<Method | null>(
    currentMethod === 'manual' ? 'manual' : currentMethod === 'stripe_pending' ? 'stripe_pending' : null
  );

  function handleIbanChange(value: string) {
    // Formata enquanto digita
    const raw = value.replace(/\s+/g, '').toUpperCase();
    setIban(raw.length > 0 ? formatIBAN(raw) : '');
  }

  // Converte DD/MM/YYYY → YYYY-MM-DD para o backend
  function parseDob(input: string): string {
    const parts = input.split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return input;
  }

  async function handleSubmit() {
    setStatus('saving');
    setErrorMsg('');

    try {
      let body: Record<string, unknown>;

      if (selectedMethod === 'stripe_pending') {
        body = {
          method: 'stripe_pending',
          full_name: fullName,
          dob: parseDob(dob),
          iban: iban.replace(/\s+/g, ''),
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          postal_code: postalCode,
          country: 'IE',
        };
      } else {
        body = {
          method: 'manual',
          manual_payment_key: manualKey,
        };
      }

      const res = await fetch('/api/settings/payment-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Erro ao salvar configuração');
        setStatus('error');
        return;
      }

      setSavedMethod(selectedMethod);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 5000);
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
      setStatus('error');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receber Pagamentos</CardTitle>
        <CardDescription>
          Configure como deseja receber os pagamentos dos seus clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Status salvo anteriormente */}
        {savedMethod && status === 'idle' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              {savedMethod === 'manual'
                ? '✅ Pagamento manual ativado'
                : '✅ Configuração salva — em processamento'}
            </p>
          </div>
        )}

        {/* Seleção de método */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedMethod('stripe_pending')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedMethod === 'stripe_pending'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <CreditCard className={`h-5 w-5 mb-2 ${selectedMethod === 'stripe_pending' ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="font-medium text-sm">Automático</p>
            <p className="text-xs text-muted-foreground mt-0.5">Via cartão / transferência</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMethod('manual')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedMethod === 'manual'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <Smartphone className={`h-5 w-5 mb-2 ${selectedMethod === 'manual' ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="font-medium text-sm">Manual</p>
            <p className="text-xs text-muted-foreground mt-0.5">PIX, IBAN ou outro</p>
          </button>
        </div>

        {/* Formulário Automático (Stripe pending) */}
        {selectedMethod === 'stripe_pending' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nome completo <span className="text-destructive">*</span></Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Maria Silva"
                disabled={status === 'saving'}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dob">Data de nascimento <span className="text-destructive">*</span></Label>
              <Input
                id="dob"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                disabled={status === 'saving'}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={iban}
                onChange={(e) => handleIbanChange(e.target.value)}
                placeholder="IE29 AIBK 9311 5212 3456 78"
                maxLength={32}
                disabled={status === 'saving'}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Formato: IE + 20 dígitos</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addressLine1">Morada (linha 1) <span className="text-destructive">*</span></Label>
              <Input
                id="addressLine1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Ex: 12 Main Street"
                disabled={status === 'saving'}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addressLine2">Morada (linha 2)</Label>
              <Input
                id="addressLine2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apartamento, andar... (opcional)"
                disabled={status === 'saving'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade <span className="text-destructive">*</span></Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Dublin"
                  disabled={status === 'saving'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">Código postal <span className="text-destructive">*</span></Label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Ex: D01 F5P2"
                  disabled={status === 'saving'}
                />
              </div>
            </div>
          </div>
        )}

        {/* Formulário Manual */}
        {selectedMethod === 'manual' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="manualKey">Chave PIX ou IBAN <span className="text-destructive">*</span></Label>
              <Input
                id="manualKey"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="Ex: IE29AIBK... ou email@pix.com"
                disabled={status === 'saving'}
              />
              <p className="text-xs text-muted-foreground">
                Esta chave será exibida ao cliente após o agendamento.
              </p>
            </div>
          </div>
        )}

        {/* Feedback de erro */}
        {status === 'error' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-300">{errorMsg}</p>
          </div>
        )}

        {/* Feedback de sucesso */}
        {status === 'success' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              {selectedMethod === 'manual'
                ? 'Pagamento manual configurado com sucesso!'
                : 'Configuração salva! Você receberá uma notificação quando a verificação for concluída.'}
            </p>
          </div>
        )}

        {/* Botão de submit */}
        <Button
          onClick={handleSubmit}
          disabled={status === 'saving'}
          className="w-full"
        >
          {status === 'saving' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Salvo!
            </>
          ) : selectedMethod === 'manual' ? (
            'Usar Pagamento Manual'
          ) : (
            'Configurar Pagamentos Automáticos'
          )}
        </Button>

      </CardContent>
    </Card>
  );
}
