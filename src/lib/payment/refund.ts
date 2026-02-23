import { getStripeServer } from '@/lib/stripe/server';

interface RefundResult {
  success: boolean;
  refund_id?: string;
  error?: string;
}

/**
 * Emite reembolso de um sinal/depósito via Stripe.
 *
 * @param paymentIntentId  ID do PaymentIntent original
 * @param amountCents      Valor a reembolsar em centavos (omitir = reembolso total)
 */
export async function refundDeposit(
  paymentIntentId: string,
  amountCents?: number
): Promise<RefundResult> {
  const stripe = getStripeServer();
  if (!stripe) {
    return { success: false, error: 'Stripe não configurado' };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amountCents != null && { amount: amountCents }),
    });
    return { success: true, refund_id: refund.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao processar reembolso';
    return { success: false, error: message };
  }
}
