import { Router } from 'express';
import { pool, query } from '../db.js';
import { computeSaleFromCatalog, pickMarginRule } from '../pricing.js';
import { invalidatePricingCache } from '../pricingLoader.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

/** Public — calcul livraison panier */
router.post('/shipping/calculate', async (req, res, next) => {
  try {
    const subtotal = Number(req.body?.subtotal_ht);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return res.status(400).json({ error: 'subtotal_ht invalide' });
    }
    const familyIds = Array.isArray(req.body?.family_ids)
      ? req.body.family_ids.map((id) => Number(id)).filter(Number.isFinite)
      : [];
    const rules = await query(`SELECT * FROM shipping_rules WHERE active = true`);
    const { computeShipping } = await import('../pricing.js');
    const result = computeShipping(subtotal, rules.rows, { familyIds });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.use(requireAdmin);

router.get('/margin-rules', async (_req, res, next) => {
  try {
    const r = await query(
      `SELECT m.*, f.name AS family_name, c.name AS category_name
       FROM margin_rules m
       LEFT JOIN families f ON f.id = m.family_id
       LEFT JOIN categories c ON c.id = m.category_id
       ORDER BY m.priority DESC, f.name NULLS LAST, c.name NULLS LAST`
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.post('/margin-rules', async (req, res, next) => {
  try {
    const {
      family_id,
      category_id,
      brand,
      margin_percent,
      fixed_markup,
      priority,
      label,
      active,
    } = req.body;
    const r = await query(
      `INSERT INTO margin_rules
        (family_id, category_id, brand, margin_percent, fixed_markup, priority, label, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        family_id || null,
        category_id || null,
        brand?.trim() || null,
        margin_percent ?? 0,
        fixed_markup ?? 0,
        priority ?? 0,
        label || null,
        active !== false,
      ]
    );
    res.status(201).json(r.rows[0]);
    invalidatePricingCache();
  } catch (e) {
    next(e);
  }
});

router.put('/margin-rules/:id', async (req, res, next) => {
  try {
    const {
      family_id,
      category_id,
      brand,
      margin_percent,
      fixed_markup,
      priority,
      label,
      active,
    } = req.body;
    const r = await query(
      `UPDATE margin_rules SET
         family_id = $1, category_id = $2, brand = $3,
         margin_percent = $4, fixed_markup = $5, priority = $6,
         label = $7, active = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [
        family_id || null,
        category_id || null,
        brand?.trim() || null,
        margin_percent ?? 0,
        fixed_markup ?? 0,
        priority ?? 0,
        label || null,
        active !== false,
        req.params.id,
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Introuvable' });
    invalidatePricingCache();
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/margin-rules/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM margin_rules WHERE id = $1', [req.params.id]);
    invalidatePricingCache();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/exceptions', async (_req, res, next) => {
  try {
    const r = await query(
      `SELECT e.*, r.diameter, p.name AS product_name, p.brand
       FROM price_exceptions e
       LEFT JOIN references_sku r ON r.code = e.code
       LEFT JOIN products p ON p.id = r.product_id
       ORDER BY e.updated_at DESC`
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.post('/exceptions', async (req, res, next) => {
  try {
    const {
      code,
      exception_type,
      price_sale_ht,
      margin_percent,
      fixed_markup,
      offer_price_ht,
      offer_label,
      offer_ends_at,
      notes,
      active,
    } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'Code requis' });

    const r = await query(
      `INSERT INTO price_exceptions
        (code, exception_type, price_sale_ht, margin_percent, fixed_markup,
         offer_price_ht, offer_label, offer_ends_at, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (code) DO UPDATE SET
         exception_type = EXCLUDED.exception_type,
         price_sale_ht = EXCLUDED.price_sale_ht,
         margin_percent = EXCLUDED.margin_percent,
         fixed_markup = EXCLUDED.fixed_markup,
         offer_price_ht = EXCLUDED.offer_price_ht,
         offer_label = EXCLUDED.offer_label,
         offer_ends_at = EXCLUDED.offer_ends_at,
         notes = EXCLUDED.notes,
         active = EXCLUDED.active,
         updated_at = NOW()
       RETURNING *`,
      [
        String(code).trim(),
        exception_type || 'manual_price',
        price_sale_ht ?? null,
        margin_percent ?? null,
        fixed_markup ?? 0,
        offer_price_ht ?? null,
        offer_label || null,
        offer_ends_at || null,
        notes || null,
        active !== false,
      ]
    );

    if (exception_type === 'manual_price' && price_sale_ht != null) {
      await query(
        `UPDATE references_sku SET price_sale_ht = $1, price_is_manual = true, updated_at = NOW()
         WHERE code = $2`,
        [price_sale_ht, String(code).trim()]
      );
    }

    res.status(201).json(r.rows[0]);
    invalidatePricingCache();
  } catch (e) {
    next(e);
  }
});

router.delete('/exceptions/:id', async (req, res, next) => {
  try {
    const ex = await query('SELECT code FROM price_exceptions WHERE id = $1', [req.params.id]);
    await query('DELETE FROM price_exceptions WHERE id = $1', [req.params.id]);
    if (ex.rows[0]?.code) {
      await query(
        `UPDATE references_sku SET price_is_manual = false WHERE code = $1 AND price_is_manual = true`,
        [ex.rows[0].code]
      );
    }
    invalidatePricingCache();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** Recalcule price_sale_ht depuis marges (sans toucher aux prix manuels / exceptions) */
router.post('/recalculate', async (_req, res, next) => {
  const client = await pool.connect();
  try {
    const marginRes = await client.query(
      `SELECT * FROM margin_rules WHERE active = true`
    );
    const exceptionRes = await client.query(
      `SELECT code FROM price_exceptions WHERE active = true`
    );
    const exceptCodes = new Set(exceptionRes.rows.map((r) => r.code));

    const refs = await client.query(
      `SELECT r.*, p.family_id, p.category_id, p.brand
       FROM references_sku r
       JOIN products p ON p.id = r.product_id
       WHERE r.price_is_manual = false`
    );

    let updated = 0;
    let skipped = 0;

    await client.query('BEGIN');

    for (const ref of refs.rows) {
      if (exceptCodes.has(ref.code)) {
        skipped++;
        continue;
      }
      const rule = pickMarginRule(
        {
          familyId: ref.family_id,
          categoryId: ref.category_id,
          brand: ref.brand,
        },
        marginRes.rows
      );
      const catalog = ref.price_catalog_ht ?? ref.price_ht;
      const sale = computeSaleFromCatalog(catalog, rule);
      if (sale == null) {
        skipped++;
        continue;
      }
      await client.query(
        `UPDATE references_sku SET price_sale_ht = $1, updated_at = NOW() WHERE id = $2`,
        [sale, ref.id]
      );
      updated++;
    }

    await client.query('COMMIT');
    invalidatePricingCache();
    res.json({ ok: true, updated, skipped, total: refs.rows.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.get('/shipping-rules', async (_req, res, next) => {
  try {
    const r = await query(
      `SELECT s.*, f.name AS family_name
       FROM shipping_rules s
       LEFT JOIN families f ON f.id = s.family_id
       ORDER BY s.priority DESC, s.name`
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.post('/shipping-rules', async (req, res, next) => {
  try {
    const {
      name,
      rule_type,
      min_order_total,
      max_order_total,
      fee_ht,
      free_above,
      family_id,
      priority,
      active,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
    const r = await query(
      `INSERT INTO shipping_rules
        (name, rule_type, min_order_total, max_order_total, fee_ht, free_above, family_id, priority, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        name.trim(),
        rule_type || 'order_total',
        min_order_total ?? null,
        max_order_total ?? null,
        fee_ht ?? 0,
        free_above ?? null,
        family_id || null,
        priority ?? 0,
        active !== false,
      ]
    );
    res.status(201).json(r.rows[0]);
    invalidatePricingCache();
  } catch (e) {
    next(e);
  }
});

router.put('/shipping-rules/:id', async (req, res, next) => {
  try {
    const {
      name,
      rule_type,
      min_order_total,
      max_order_total,
      fee_ht,
      free_above,
      family_id,
      priority,
      active,
    } = req.body;
    const r = await query(
      `UPDATE shipping_rules SET
         name = $1, rule_type = $2, min_order_total = $3, max_order_total = $4,
         fee_ht = $5, free_above = $6, family_id = $7, priority = $8, active = $9,
         updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        name?.trim(),
        rule_type,
        min_order_total ?? null,
        max_order_total ?? null,
        fee_ht ?? 0,
        free_above ?? null,
        family_id || null,
        priority ?? 0,
        active !== false,
        req.params.id,
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Introuvable' });
    invalidatePricingCache();
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/shipping-rules/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM shipping_rules WHERE id = $1', [req.params.id]);
    invalidatePricingCache();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
