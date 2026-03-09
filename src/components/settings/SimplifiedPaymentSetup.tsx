'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, CreditCard, Smartphone } from 'lucide-react';
import { formatIBAN } from '@/lib/validators/iban';
import { validatePaymentAccount, getAccountLabel } from '@/lib/validators/payment-account';

type Method = 'stripe_pending' | 'manual';
type Status = 'idle' | 'saving' | 'success' | 'error';

interface Country {
  code: string;
  label: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: 'IE', label: 'Ireland', flag: '🇮🇪' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', label: 'Germany', flag: '🇩🇪' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'ES', label: 'Spain', flag: '🇪🇸' },
  { code: 'PT', label: 'Portugal', flag: '🇵🇹' },
  { code: 'IT', label: 'Italy', flag: '🇮🇹' },
  { code: 'NL', label: 'Netherlands', flag: '🇳🇱' },
  { code: 'BR', label: 'Brasil', flag: '🇧🇷' },
  { code: 'US', label: 'United States', flag: '🇺🇸' },
];

interface SimplifiedPaymentSetupProps {
  currentMethod?: string | null;
  currentKey?: string | null;
  currentCountry?: string | null;
}

export function SimplifiedPaymentSetup({
  currentMethod,
  currentKey,
  currentCountry,
}: SimplifiedPaymentSetupProps) {
  const t = useTranslations('payment');

  const [selectedMethod, setSelectedMethod] = useState<Method>(
    currentMethod === 'manual' ? 'manual' : 'stripe_pending'
  );

  // Stripe fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState(
    currentCountry || COUNTRIES[0].code
  );

  // Manual field
  const [manualKey, setManualKey] = useState(currentKey || '');

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMethod, setSavedMethod] = useState<Method | null>(
    currentMethod === 'manual' ? 'manual' : currentMethod === 'stripe_pending' ? 'stripe_pending' : null
  );

  const isEuropean = !['BR', 'US'].includes(country);
  const accountMeta = getAccountLabel(country);

  function handleAccountChange(value: string) {
    if (isEuropean) {
      const raw = value.replace(/\s+/g, '').toUpperCase();
      setAccountNumber(raw.length > 0 ? formatIBAN(raw) : '');
    } else {
      setAccountNumber(value);
    }
  }

  function handleDobChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Mantém apenas dígitos e aplica máscara DD/MM/AAAA automaticamente
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let masked = digits;
    if (digits.length > 2) masked = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) masked = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
    setDob(masked);
    setDobError(digits.length === 8 ? (getDobError(masked) ?? '') : '');
  }

  // Retorna string de erro ou null se válido
  function getDobError(value: string): string | null {
    const parts = value.split('/');
    if (parts.length !== 3 || value.length < 10) return 'Data incompleta — use DD/MM/AAAA';
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const maxYear = new Date().getFullYear() - 18;
    if (year < 1900 || year > maxYear) return `Ano deve ser entre 1900 e ${maxYear}`;
    if (month < 1 || month > 12) return 'Mês inválido (01–12)';
    if (day < 1 || day > 31) return 'Dia inválido (01–31)';
    // Verifica se a data existe de fato (ex: 31/02 é inválido)
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return 'Data inválida';
    }
    return null;
  }

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

    // Validações client-side
    if (selectedMethod === 'stripe_pending') {
      if (!fullName.trim()) {
        setErrorMsg(t('setupErrorName'));
        setStatus('error');
        return;
      }
      if (!dob.trim() || dob.length < 10) {
        setErrorMsg(t('setupErrorDob'));
        setStatus('error');
        return;
      }
      const dobErr = getDobError(dob);
      if (dobErr) {
        setDobError(dobErr);
        setErrorMsg(dobErr);
        setStatus('error');
        return;
      }
      if (!addressLine1.trim() || !city.trim() || !postalCode.trim()) {
        setErrorMsg(t('setupErrorAddress'));
        setStatus('error');
        return;
      }
      if (accountNumber.trim()) {
        const validation = validatePaymentAccount(accountNumber, country);
        if (!validation.valid) {
          setErrorMsg(validation.message ?? t('setupErrorAccount'));
          setStatus('error');
          return;
        }
      }
    }

    if (selectedMethod === 'manual' && !manualKey.trim()) {
      setErrorMsg(t('setupErrorManualKey'));
      setStatus('error');
      return;
    }

    try {
      let body: Record<string, unknown>;

      if (selectedMethod === 'stripe_pending') {
        body = {
          method: 'stripe_pending',
          full_name: fullName,
          dob: parseDob(dob),
          iban: accountNumber.replace(/\s+/g, ''),
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          postal_code: postalCode,
          country,
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
        setErrorMsg(data.error || t('setupErrorSave'));
        setStatus('error');
        return;
      }

      setSavedMethod(selectedMethod);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 5000);
    } catch {
      setErrorMsg(t('setupErrorNetwork'));
      setStatus('error');
    }
  }

  return (
    <div className="space-y-6">
        {/* Status salvo anteriormente */}
        {savedMethod && status === 'idle' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              {savedMethod === 'manual' ? t('setupSavedManual') : t('setupSavedStripe')}
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
            <p className="font-medium text-sm">{t('setupMethodAuto')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('setupMethodAutoDesc')}</p>
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
            <p className="font-medium text-sm">{t('setupMethodManual')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('setupMethodManualDesc')}</p>
          </button>
        </div>

        {/* Formulário Automático */}
        {selectedMethod === 'stripe_pending' && (
          <div className="space-y-4">
            {/* País */}
            <div className="space-y-1.5">
              <Label htmlFor="country">{t('setupCountry')} <span className="text-destructive">*</span></Label>
              <select
                id="country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setAccountNumber('');
                }}
                disabled={status === 'saving'}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.label} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Nome completo */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName">{t('setupFullName')} <span className="text-destructive">*</span></Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('setupFullNamePlaceholder')}
                disabled={status === 'saving'}
              />
            </div>

            {/* Data de nascimento */}
            <div className="space-y-1.5">
              <Label htmlFor="dob">{t('setupDob')} <span className="text-destructive">*</span></Label>
              <Input
                id="dob"
                value={dob}
                onChange={handleDobChange}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                inputMode="numeric"
                disabled={status === 'saving'}
                className={dobError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {dobError && (
                <p className="text-xs text-destructive">{dobError}</p>
              )}
            </div>

            {/* Conta bancária (dinâmica por país) */}
            <div className="space-y-1.5">
              <Label htmlFor="accountNumber">{accountMeta.label}</Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => handleAccountChange(e.target.value)}
                placeholder={accountMeta.placeholder}
                maxLength={isEuropean ? 36 : 60}
                disabled={status === 'saving'}
                className={isEuropean ? 'font-mono' : ''}
              />
              <p className="text-xs text-muted-foreground">{accountMeta.hint}</p>
            </div>

            {/* Morada */}
            <div className="space-y-1.5">
              <Label htmlFor="addressLine1">{t('setupAddress1')} <span className="text-destructive">*</span></Label>
              <Input
                id="addressLine1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder={t('setupAddress1Placeholder')}
                disabled={status === 'saving'}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addressLine2">{t('setupAddress2')}</Label>
              <Input
                id="addressLine2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder={t('setupAddress2Placeholder')}
                disabled={status === 'saving'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">{t('setupCity')} <span className="text-destructive">*</span></Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('setupCityPlaceholder')}
                  disabled={status === 'saving'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">{t('setupPostalCode')} <span className="text-destructive">*</span></Label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder={t('setupPostalCodePlaceholder')}
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
              <Label htmlFor="manualKey">{t('setupManualKey')} <span className="text-destructive">*</span></Label>
              <Input
                id="manualKey"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder={t('setupManualKeyPlaceholder')}
                disabled={status === 'saving'}
              />
              <p className="text-xs text-muted-foreground">{t('setupManualKeyHint')}</p>
            </div>
          </div>
        )}

        {/* Erro */}
        {status === 'error' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-300">{errorMsg}</p>
          </div>
        )}

        {/* Sucesso */}
        {status === 'success' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              {selectedMethod === 'manual' ? t('setupSuccessManual') : t('setupSuccessStripe')}
            </p>
          </div>
        )}

        {/* Botão */}
        <Button
          onClick={handleSubmit}
          disabled={status === 'saving'}
          className="w-full"
        >
          {status === 'saving' ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('setupSaving')}</>
          ) : status === 'success' ? (
            <><CheckCircle2 className="h-4 w-4 mr-2" />{t('setupSaved')}</>
          ) : selectedMethod === 'manual' ? (
            t('setupBtnManual')
          ) : (
            t('setupBtnAuto')
          )}
        </Button>
    </div>
  );
}
