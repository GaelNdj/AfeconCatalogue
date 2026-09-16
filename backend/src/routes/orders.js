import { Router } from 'express';
import { query, pool } from '../db.js';
import { assertSameOrigin, attachUser, requireUser } from '../middleware/userAuth.js';
import { requireAdmin } from '../middleware/auth.js';
import { createOrderFromQuote } from '../services/orderBuilder.js';
import { buildOrderPdf } from '../services/documentPdf.js';
import { sendOrderConfirmationEmails } from '../services/mail.js';

const router = Router();

router.use(attachUser);
router.use(requireUser);

router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT o.id, o.order_number, o.status, o.total_cdf, o.total_usd, o.created_at,
              q.quote_number
       FROM orders o
       JOIN quotes q ON q.id = o.quote_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ items: r.rows });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const o = await query(
      `SELECT o.*, q.quote_number
       FROM orders o
       JOIN quotes q ON q.id = o.quote_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, req.user.id]
    );
    if (!o.rows[0]) return res.status(404).json({ error: 'Commande introuvable' });
    const order = o.rows[0];
    const lines = await query(
      `SELECT * FROM order_lines WHERE order_id = $1 ORDER BY sort_order, id`,
      [id]
    );
    const pdf = await buildOrderPdf(order, lines.rows, order.quote_number);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${order.order_number}.pdf"`
    );
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const o = await query(
      `SELECT o.*, q.quote_number, q.id AS quote_id
       FROM orders o
       JOIN quotes q ON q.id = o.quote_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, req.user.id]
    );
    if (!o.rows[0]) return res.status(404).json({ error: 'Commande introuvable' });
    const lines = await query(
      `SELECT * FROM order_lines WHERE order_id = $1 ORDER BY sort_order, id`,
      [id]
    );
    res.json({ order: o.rows[0], lines: lines.rows });
  } catch (e) {
    next(e);
  }
});

router.post('/', assertSameOrigin, async (req, res, next) => {
  const db = await pool.connect();
  try {
    const quoteId = parseInt(req.body?.quote_id, 10);
    if (!Number.isFinite(quoteId)) {
      return res.status(400).json({ error: 'quote_id requis' });
    }

    await db.query('BEGIN');
    const { order, quote } = await createOrderFromQuote(quoteId, req.user.id, db);
    await db.query('COMMIT');

    const emailResult = await sendOrderConfirmationEmails({
      order,
      quote,
      customerEmail: req.user.email,
    });

    res.status(201).json({
      order,
      emailSent: emailResult.clientSent || emailResult.adminSent,
    });
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  } finally {
    db.release();
  }
});

const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get('/', async (_req, res, next) => {
  try {
    const r = await query(
      `SELECT o.id, o.order_number, o.status, o.total_cdf, o.total_usd, o.created_at,
              q.quote_number, u.email AS user_email,
              o.customer_snapshot->>'company_name' AS company_name
       FROM orders o
       JOIN quotes q ON q.id = o.quote_id
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC
       LIMIT 200`
    );
    res.json({ items: r.rows });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const status = String(req.body?.status || '').trim();
    const allowed = ['received', 'preparing', 'shipped'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const r = await query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Commande introuvable' });
    res.json({ order: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

export { adminRouter };
export default router;
