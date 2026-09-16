import { Router } from 'express';
import { query, pool } from '../db.js';
import { assertSameOrigin, attachUser, requireUser } from '../middleware/userAuth.js';
import { buildQuoteFromItems, nextQuoteNumber } from '../services/quoteBuilder.js';
import { buildQuotePdf } from '../services/documentPdf.js';

const router = Router();

router.use(attachUser);
router.use(requireUser);

router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT id, quote_number, status, subtotal_ht, shipping_ht, total_ht,
              total_cdf, total_usd, valid_until, created_at
       FROM quotes
       WHERE user_id = $1
       ORDER BY created_at DESC
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
    const q = await query(
      `SELECT * FROM quotes WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: 'Devis introuvable' });
    const lines = await query(
      `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order, id`,
      [id]
    );
    const pdf = await buildQuotePdf(q.rows[0], lines.rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${q.rows[0].quote_number}.pdf"`
    );
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const q = await query(
      `SELECT q.*, o.id AS order_id, o.order_number
       FROM quotes q
       LEFT JOIN orders o ON o.quote_id = q.id
       WHERE q.id = $1 AND q.user_id = $2`,
      [id, req.user.id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: 'Devis introuvable' });
    const lines = await query(
      `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order, id`,
      [id]
    );
    res.json({ quote: q.rows[0], lines: lines.rows });
  } catch (e) {
    next(e);
  }
});

router.post('/', assertSameOrigin, async (req, res, next) => {
  const db = await pool.connect();
  try {
    const items = req.body?.items;
    const built = await buildQuoteFromItems(items);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const snapshot = {
      email: req.user.email,
      company_name: req.body?.company_name?.trim() || req.user.company_name,
      phone: req.body?.phone?.trim() || req.user.phone,
      address_line: req.body?.address_line?.trim() || req.user.address_line,
      city: req.body?.city?.trim() || req.user.city,
    };

    if (!snapshot.company_name) {
      return res.status(400).json({ error: 'Nom de société requis' });
    }

    await db.query('BEGIN');
    const quoteNumber = await nextQuoteNumber();
    const ins = await db.query(
      `INSERT INTO quotes (
         quote_number, user_id, status,
         subtotal_ht, shipping_ht, total_ht,
         subtotal_cdf, shipping_cdf, total_cdf,
         subtotal_usd, shipping_usd, total_usd,
         eur_to_cdf, eur_to_usd, shipping_rule_name, valid_until, customer_snapshot
       ) VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        quoteNumber,
        req.user.id,
        built.subtotal_ht,
        built.shipping_ht,
        built.total_ht,
        built.subtotal_cdf,
        built.shipping_cdf,
        built.total_cdf,
        built.subtotal_usd,
        built.shipping_usd,
        built.total_usd,
        built.eur_to_cdf,
        built.eur_to_usd,
        built.shipping_rule_name,
        validUntil.toISOString().slice(0, 10),
        JSON.stringify(snapshot),
      ]
    );
    const quote = ins.rows[0];

    for (const line of built.lines) {
      await db.query(
        `INSERT INTO quote_lines (
           quote_id, reference_id, sku_code, internal_code, ref_pro,
           product_name, variant_label, diameter, qty,
           unit_price_ht, unit_price_cdf, unit_price_usd,
           line_total_ht, line_total_cdf, line_total_usd, price_on_quote, sort_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          quote.id,
          line.reference_id,
          line.sku_code,
          line.internal_code,
          line.ref_pro,
          line.product_name,
          line.variant_label,
          line.diameter,
          line.qty,
          line.unit_price_ht,
          line.unit_price_cdf,
          line.unit_price_usd,
          line.line_total_ht,
          line.line_total_cdf,
          line.line_total_usd,
          line.price_on_quote,
          line.sort_order,
        ]
      );
    }

    if (snapshot.company_name !== req.user.company_name) {
      await db.query(
        `UPDATE users SET company_name = $1, phone = COALESCE($2, phone),
           address_line = COALESCE($3, address_line), city = COALESCE($4, city), updated_at = NOW()
         WHERE id = $5`,
        [
          snapshot.company_name,
          snapshot.phone,
          snapshot.address_line,
          snapshot.city,
          req.user.id,
        ]
      );
    }

    await db.query('COMMIT');
    res.status(201).json({
      quote,
      lines: built.lines,
      warnings: built.errors,
    });
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    if (e.status) return res.status(e.status).json({ error: e.message, details: e.details });
    next(e);
  } finally {
    db.release();
  }
});

export default router;
