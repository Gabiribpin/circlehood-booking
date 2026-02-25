export interface PlanPrice {
  priceId: string;
  amount: number;   // e.g. 25 (not in cents)
  symbol: string;   // e.g. '€'
  currency: string; // lowercase, e.g. 'eur'
}

function getPriceId(currency: string): string {
  const fallback = process.env.STRIPE_PRICE_ID ?? '';
  switch (currency) {
    case 'eur': return process.env.STRIPE_PRICE_ID_EUR ?? fallback;
    case 'gbp': return process.env.STRIPE_PRICE_ID_GBP ?? fallback;
    case 'brl': return process.env.STRIPE_PRICE_ID_BRL ?? fallback;
    case 'usd': return process.env.STRIPE_PRICE_ID_USD ?? fallback;
    default:    return process.env.STRIPE_PRICE_ID_EUR ?? fallback;
  }
}

const PLAN_AMOUNTS: Record<string, [number, string]> = {
  eur: [25,  '€'],
  gbp: [22,  '£'],
  brl: [139, 'R$'],
  usd: [27,  '$'],
};

export function getPlanPrice(currency: string): PlanPrice {
  const key = (currency ?? 'eur').toLowerCase();
  const [amount, symbol] = PLAN_AMOUNTS[key] ?? PLAN_AMOUNTS['eur'];
  return {
    priceId: getPriceId(key),
    amount,
    symbol,
    currency: key,
  };
}
