import { Router } from 'express';
import { getCurrencyRates } from '../currency.js';
import { isStripeConfigured } from '../services/stripePayments.js';
import { isSmtpConfigured } from '../services/mailTransporter.js';

const router = Router();

router.get('/mail', (_req, res) => {
  res.json({
    smtp_configured: isSmtpConfigured(),
    has_contact_to: Boolean(process.env.CONTACT_TO_EMAIL?.trim()),
    has_orders_to: Boolean(process.env.ORDERS_TO_EMAIL?.trim()),
  });
});

router.get('/payments', (_req, res) => {
  res.json({
    stripe_configured: isStripeConfigured(),
    publishable_key: process.env.STRIPE_PUBLISHABLE_KEY?.trim() || null,
  });
});

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
