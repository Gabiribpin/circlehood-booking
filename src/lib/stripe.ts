import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: '2026-01-28.clover' });
  }
  return _stripe;
}

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? '';
