import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Retorna a instância Stripe do servidor (lazy singleton).
 * Retorna null se STRIPE_SECRET_KEY não estiver configurada — permite
 * que o sistema funcione sem pagamentos quando não configurado.
 */
export function getStripeServer(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key, { maxNetworkRetries: 3 });
  }
  return _stripe;
}
