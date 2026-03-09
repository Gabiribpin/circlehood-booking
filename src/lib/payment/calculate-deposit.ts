/**
 * Calcula o valor do sinal (depósito) a ser cobrado.
 *
 * @param servicePrice  Preço total do serviço
 * @param depositType   'percentage' | 'fixed'
 * @param depositValue  Percentagem (0-100) ou valor fixo
 * @returns Valor do sinal, arredondado para 2 casas decimais
 */
export function calculateDeposit(
  servicePrice: number,
  depositType: 'percentage' | 'fixed',
  depositValue: number
): number {
  if (depositType === 'percentage') {
    return Math.round((servicePrice * depositValue) / 100 * 100) / 100;
  }
  // Cap fixed deposit to service price
  const capped = Math.min(depositValue, servicePrice);
  return Math.round(capped * 100) / 100;
}

/**
 * Converte valor monetário para centavos (unidade mínima Stripe).
 * Suporta todas as moedas de 2 casas decimais (EUR, USD, GBP, BRL).
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
