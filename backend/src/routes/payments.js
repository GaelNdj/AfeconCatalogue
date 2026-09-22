import { Router } from 'express';
import { handleStripeWebhook } from '../services/stripePayments.js';

const router = Router();

router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    const result = await handleStripeWebhook(req.body, signature);
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
