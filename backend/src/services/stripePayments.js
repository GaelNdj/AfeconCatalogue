import Stripe from 'stripe';
import { query, pool } from '../db.js';
import { sendOrderConfirmationEmails } from './mail.js';

let stripeClient = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw Object.assign(new Error('Paiement en ligne non configuré (STRIPE_SECRET_KEY)'), {
      status: 503,
    });
  }
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function amountCentsFromEur(totalHt) {
  const n = Number(totalHt);
  if (!Number.isFinite(n) || n <= 0) {
    throw Object.assign(new Error('Montant de commande invalide'), { status: 400 });
  }
  return Math.round(n * 100);
}

export async function createOrderCheckoutSession(orderId, userId) {
  const r = await query(
    `SELECT o.*, q.quote_number
     FROM orders o
     JOIN quotes q ON q.id = o.quote_id
     WHERE o.id = $1 AND o.user_id = $2`,
    [orderId, userId]
  );
  const order = r.rows[0];
  if (!order) throw Object.assign(new Error('Commande introuvable'), { status: 404 });
  if (order.payment_status === 'paid') {
    throw Object.assign(new Error('Cette commande est déjà payée'), { status: 409 });
  }

  const stripe = getStripe();
  const amount = amountCentsFromEur(order.total_ht);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    client_reference_id: String(order.id),
    metadata: {
      order_id: String(order.id),
      order_number: order.order_number,
      user_id: String(userId),
    },
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Commande ${order.order_number}`,
            description: `Devis ${order.quote_number} — total HT`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    success_url: `${frontendUrl()}/compte/commande/${order.id}/paiement?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl()}/compte/commande/${order.id}/paiement?cancelled=1`,
  });

  await query(
    `UPDATE orders SET stripe_checkout_session_id = $1, updated_at = NOW() WHERE id = $2`,
    [session.id, order.id]
  );

  return { url: session.url, sessionId: session.id };
}

export async function markOrderPaid(orderId, { sessionId, paymentIntentId } = {}) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const o = await db.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    const order = o.rows[0];
    if (!order) {
      await db.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }
    if (order.payment_status === 'paid') {
      await db.query('COMMIT');
      return { ok: true, alreadyPaid: true, order };
    }

    await db.query(
      `UPDATE orders SET
         payment_status = 'paid',
         status = 'received',
         stripe_checkout_session_id = COALESCE($2, stripe_checkout_session_id),
         stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
         paid_at = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [orderId, sessionId || null, paymentIntentId || null]
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    const quote = await db.query(`SELECT * FROM quotes WHERE id = $1`, [order.quote_id]);
    await db.query('COMMIT');

    const freshOrder = updated.rows[0];
    const customerEmail = await db.query(`SELECT email FROM users WHERE id = $1`, [order.user_id]);
    await sendOrderConfirmationEmails({
      order: freshOrder,
      quote: quote.rows[0],
      customerEmail: customerEmail.rows[0]?.email,
    }).catch((err) => {
      console.error(`[order ${freshOrder.order_number}] E-mails post-paiement:`, err.message);
    });

    return { ok: true, order: freshOrder };
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}

export async function confirmCheckoutSessionForUser(orderId, userId, sessionId) {
  if (!sessionId?.trim()) {
    throw Object.assign(new Error('session_id requis'), { status: 400 });
  }
  const r = await query(`SELECT id, user_id FROM orders WHERE id = $1`, [orderId]);
  const order = r.rows[0];
  if (!order || order.user_id !== userId) {
    throw Object.assign(new Error('Commande introuvable'), { status: 404 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (String(session.metadata?.order_id) !== String(orderId)) {
    throw Object.assign(new Error('Session de paiement invalide'), { status: 400 });
  }
  if (session.payment_status !== 'paid') {
    throw Object.assign(new Error('Paiement non finalisé'), { status: 400 });
  }

  const result = await markOrderPaid(orderId, {
    sessionId: session.id,
    paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
  });
  return result.order;
}

export async function handleStripeWebhook(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.warn('[stripe] STRIPE_WEBHOOK_SECRET manquant — webhook ignoré');
    return { received: true };
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    throw Object.assign(new Error(`Webhook Stripe invalide: ${err.message}`), { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = parseInt(session.metadata?.order_id, 10);
    if (Number.isFinite(orderId)) {
      await markOrderPaid(orderId, {
        sessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
      });
    }
  }

  return { received: true };
}
