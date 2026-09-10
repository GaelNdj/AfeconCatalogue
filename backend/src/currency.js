/** Taux EUR → devises locales (configurables via .env). */
export function getCurrencyRates() {
  return {
    eurToCdf: Number(process.env.EUR_TO_CDF) || 2850,
    eurToUsd: Number(process.env.EUR_TO_USD) || 1.08,
  };
}

export function roundCdf(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n));
}

export function roundUsd(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 100) / 100;
}

export function eurToCdfAmount(eur, rates = getCurrencyRates()) {
  if (eur == null || !Number.isFinite(Number(eur))) return null;
  return roundCdf(Number(eur) * rates.eurToCdf);
}

export function eurToUsdAmount(eur, rates = getCurrencyRates()) {
  if (eur == null || !Number.isFinite(Number(eur))) return null;
  return roundUsd(Number(eur) * rates.eurToUsd);
}

export function cdfToUsdAmount(cdf, rates = getCurrencyRates()) {
  if (cdf == null || !Number.isFinite(Number(cdf))) return null;
  return roundUsd(Number(cdf) * rates.eurToUsd / rates.eurToCdf);
}

/**
 * Enrichit le prix public avec CDF (principal) et USD (secondaire).
 * Prix manuel CDF prioritaire sur la conversion EUR.
 */
export function applyPublicCurrency(pricing, ref) {
  const rates = getCurrencyRates();

  if (pricing.price_source === 'quote' || ref.price_on_quote) {
    return {
      ...pricing,
      display_price_cdf: null,
      display_price_usd: null,
      price_currency_mode: 'quote',
    };
  }

  if (ref.price_is_manual_cdf && ref.price_sale_cdf != null) {
    const cdf = roundCdf(ref.price_sale_cdf);
    const usd = cdfToUsdAmount(cdf, rates);
    return {
      ...pricing,
      display_price_cdf: cdf,
      display_price_usd: usd,
      price_currency_mode: 'manual_cdf',
    };
  }

  const eur = pricing.display_price_ht;
  if (eur == null) {
    return {
      ...pricing,
      display_price_cdf: null,
      display_price_usd: null,
      price_currency_mode: null,
    };
  }

  return {
    ...pricing,
    display_price_cdf: eurToCdfAmount(eur, rates),
    display_price_usd: eurToUsdAmount(eur, rates),
    price_currency_mode: 'converted',
  };
}
