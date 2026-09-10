import { Router } from 'express';
import { getCurrencyRates } from '../currency.js';

const router = Router();

router.get('/currency', (_req, res) => {
  const { eurToCdf, eurToUsd } = getCurrencyRates();
  res.json({
    eur_to_cdf: eurToCdf,
    eur_to_usd: eurToUsd,
    primary_currency: 'CDF',
    secondary_currency: 'USD',
    base_currency: 'EUR',
  });
});

export default router;
