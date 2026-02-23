'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { TimeSlots } from '@/components/booking/time-slots';
import { BookingForm } from '@/components/booking/booking-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Home,
  Building2,
} from 'lucide-react';
import type { Service } from '@/types/database';

// Lazy load do formulário de pagamento (só carrega quando necessário)
const PaymentForm = dynamic(
  () => import('@/components/checkout/payment-form').then((m) => ({ default: m.PaymentForm })),
  { loading: () => <div className="h-40 animate-pulse rounded-lg bg-muted" />, ssr: false }
);

interface WorkingHour {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface BookingSectionProps {
  services: Service[];
  professionalId: string;
  currency: string;
  workingHours: WorkingHour[];
  requireDeposit?: boolean;
  depositType?: 'percentage' | 'fixed' | null;
  depositValue?: number | null;
}

interface DepositInfo {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '\u20AC', GBP: '\u00A3', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(price).toFixed(0)}`;
}

export function BookingSection({
  services,
  professionalId,
  currency,
  workingHours,
  requireDeposit = false,
  depositType = null,
  depositValue = null,
}: BookingSectionProps) {
  const availableDays = new Set(workingHours.map(wh => wh.day_of_week));

  const disableUnavailableDays = (date: Date) => {
    const dayOfWeek = date.getDay();
    return !availableDays.has(dayOfWeek);
  };

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    notes: '',
  });
  const [selectedLocation, setSelectedLocation] = useState<'in_salon' | 'at_home'>('in_salon');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerAddressCity, setCustomerAddressCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);

  // Total de passos: se exige sinal, são 5 (+ pagamento); caso contrário, 4
  const totalSteps = requireDeposit ? 5 : 4;

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
    if (step === 3) setSelectedSlot(null);
    if (step === 5) setDepositInfo(null);
    setError('');
  }

  function selectService(service: Service) {
    setSelectedService(service);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    const loc = (service as any).service_location;
    setSelectedLocation(loc === 'at_home' ? 'at_home' : 'in_salon');
    setCustomerAddress('');
    setCustomerAddressCity('');
    setStep(2);
  }

  function selectDate(date: Date | undefined) {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (date) setStep(3);
  }

  function selectSlot(slot: string) {
    setSelectedSlot(slot);
    setStep(4);
  }

  // Passo 4 → 5 (ou confirmação direta se sem sinal)
  async function handleContinue() {
    if (!selectedService || !selectedDate || !selectedSlot || !formData.clientName || !formData.clientPhone) {
      setError('Por favor, preencha todos os campos obrigatórios, incluindo o WhatsApp.');
      return;
    }

    if (!requireDeposit) {
      // Sem sinal: submeter directamente
      await submitBooking();
      return;
    }

    // Com sinal: criar PaymentIntent
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professional_id: professionalId,
          service_id: selectedService.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao iniciar pagamento. Tente novamente.');
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      setDepositInfo({
        clientSecret: data.client_secret,
        paymentIntentId: data.payment_intent_id,
        amount: data.amount,
        currency: data.currency,
      });
      setStep(5);
    } catch {
      setError('Erro de rede. Tente novamente.');
    }
    setSubmitting(false);
  }

  // Após pagamento confirmado → criar agendamento
  async function handlePaymentSuccess(paymentIntentId: string) {
    await submitBooking(paymentIntentId);
  }

  async function submitBooking(paymentIntentId?: string) {
    if (!selectedService || !selectedDate || !selectedSlot) return;

    setSubmitting(true);
    setError('');

    const dateStr = selectedDate.toISOString().split('T')[0];

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professional_id: professionalId,
          service_id: selectedService.id,
          booking_date: dateStr,
          start_time: selectedSlot,
          client_name: formData.clientName,
          client_email: formData.clientEmail || undefined,
          client_phone: formData.clientPhone || undefined,
          notes: formData.notes || undefined,
          service_location: selectedLocation,
          customer_address: selectedLocation === 'at_home' ? (customerAddress || undefined) : undefined,
          customer_address_city: selectedLocation === 'at_home' ? (customerAddressCity || undefined) : undefined,
          ...(paymentIntentId && { payment_intent_id: paymentIntentId }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao criar agendamento.');
        setSubmitting(false);
        return;
      }

      // Confirmação: paso 5 (sem sinal) ou 6 (com sinal)
      setStep(requireDeposit ? 6 : 5);
    } catch {
      setError('Erro ao criar agendamento. Tente novamente.');
    }
    setSubmitting(false);
  }

  if (services.length === 0) return null;

  const dateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : '';
  const formattedDate = dateStr ? dateStr.split('-').reverse().join('/') : '';
  const confirmationStep = requireDeposit ? 6 : 5;

  return (
    <section className="px-4 sm:px-6 py-6">
      <h2 className="text-lg font-semibold mb-4">Agendar</h2>

      {/* Step indicator */}
      {step < confirmationStep && (
        <div className="flex items-center gap-2 mb-4">
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 px-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Passo {step} de {totalSteps}
          </span>
        </div>
      )}

      {/* Step 1: Select service */}
      {step === 1 && (
        <div className="space-y-3">
          {services.map((service) => (
            <Card
              key={service.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => selectService(service)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {service.description}
                    </p>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {service.duration_minutes} min
                  </span>
                </div>
                <div className="text-right pl-4">
                  <span className="text-lg font-bold">
                    {formatPrice(service.price, currency)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Select date */}
      {step === 2 && (
        <Card>
          <CardContent className="p-4 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={selectDate}
              disabled={[
                { before: new Date() },
                disableUnavailableDays
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Select time */}
      {step === 3 && selectedService && selectedDate && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              {selectedService.name} &mdash; {formattedDate}
            </p>
            <TimeSlots
              professionalId={professionalId}
              serviceId={selectedService.id}
              date={dateStr}
              selectedSlot={selectedSlot}
              onSelect={selectSlot}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Client info + Summary */}
      {step === 4 && selectedService && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-sm font-medium">{selectedService.name}</p>
              <p className="text-xs text-muted-foreground">
                {formattedDate} às {selectedSlot} &mdash;{' '}
                {formatPrice(selectedService.price, currency)}
              </p>
            </div>

            {/* Seleção de local para serviços "both" */}
            {(selectedService as any).service_location === 'both' && (
              <div className="space-y-2">
                <Label>Local de atendimento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLocation('in_salon')}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors ${
                      selectedLocation === 'in_salon'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-muted-foreground/20 text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Building2 className="h-5 w-5" />
                    No salão
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLocation('at_home')}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors ${
                      selectedLocation === 'at_home'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-muted-foreground/20 text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Home className="h-5 w-5" />
                    Em casa
                  </button>
                </div>
              </div>
            )}

            {/* Endereço do cliente quando for a domicílio */}
            {selectedLocation === 'at_home' && (
              <div className="space-y-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Atendimento a domicílio</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerAddress">Endereço *</Label>
                  <Input
                    id="customerAddress"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Rua, número, apt"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerAddressCity">Cidade</Label>
                  <Input
                    id="customerAddressCity"
                    value={customerAddressCity}
                    onChange={(e) => setCustomerAddressCity(e.target.value)}
                    placeholder="Ex: Dublin"
                  />
                </div>
              </div>
            )}

            <BookingForm data={formData} onChange={setFormData} />

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleContinue}
              disabled={
                !formData.clientName ||
                !formData.clientPhone ||
                (selectedLocation === 'at_home' && !customerAddress) ||
                submitting
              }
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {requireDeposit ? 'Continuar para pagamento' : 'Confirmar agendamento'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 5 (com sinal): Formulário de pagamento Stripe */}
      {step === 5 && requireDeposit && depositInfo && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-sm font-medium">{selectedService?.name}</p>
              <p className="text-xs text-muted-foreground">
                {formattedDate} às {selectedSlot}
              </p>
            </div>

            <PaymentForm
              clientSecret={depositInfo.clientSecret}
              paymentIntentId={depositInfo.paymentIntentId}
              amount={depositInfo.amount}
              currency={depositInfo.currency}
              onSuccess={handlePaymentSuccess}
              onError={(msg) => setError(msg)}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Confirmação final */}
      {step === confirmationStep && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-semibold">Agendamento confirmado!</h3>
            <p className="text-sm text-muted-foreground">
              {selectedService?.name} &mdash; {formattedDate} às {selectedSlot}
            </p>
            {formData.clientEmail && (
              <p className="text-xs text-muted-foreground">
                Um email de confirmação foi enviado para {formData.clientEmail}.
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setSelectedService(null);
                setSelectedDate(undefined);
                setSelectedSlot(null);
                setFormData({ clientName: '', clientEmail: '', clientPhone: '', notes: '' });
                setSelectedLocation('in_salon');
                setCustomerAddress('');
                setCustomerAddressCity('');
                setDepositInfo(null);
              }}
            >
              Fazer outro agendamento
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
