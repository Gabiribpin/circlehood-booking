'use client';

import { useState } from 'react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe/client';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';

interface InnerFormProps {
  amount: number;
  currency: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

const currencySymbols: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  BRL: 'R$',
};

function InnerForm({ amount, currency, onSuccess, onError }: InnerFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const sym = currencySymbols[currency?.toUpperCase()] ?? currency;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
      },
    });

    setLoading(false);

    if (result.error) {
      onError(result.error.message ?? 'Erro ao processar pagamento.');
      return;
    }

    if (result.paymentIntent?.status === 'succeeded') {
      onSuccess(result.paymentIntent.id);
    } else {
      onError('Pagamento não confirmado. Tente novamente.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Sinal de reserva: <strong>{sym}{amount.toFixed(2)}</strong>. Pagamento seguro via Stripe.
        </p>
      </div>

      <PaymentElement />

      <Button type="submit" className="w-full" disabled={loading || !stripe}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Pagar sinal {sym}{amount.toFixed(2)}
      </Button>
    </form>
  );
}

interface PaymentFormProps {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (message: string) => void;
}

export function PaymentForm({
  clientSecret,
  amount,
  currency,
  onSuccess,
  onError,
}: PaymentFormProps) {
  const stripePromise = getStripe();

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: 'stripe' },
        locale: 'pt-BR',
      }}
    >
      <InnerForm
        amount={amount}
        currency={currency}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}
