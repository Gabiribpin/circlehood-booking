import Stripe from 'stripe';

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  });
}

export const PRICE_ID = process.env.STRIPE_PRICE_ID!;
