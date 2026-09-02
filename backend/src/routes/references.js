import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = (page - 1) * limit;
    const productId = req.query.product_id || null;
    const q = (req.query.q || '').trim();

    const conditions = [];
    const params = [];
    let i = 1;

    if (productId) {
      conditions.push(`r.product_id = $${i++}`);
      params.push(productId);
    }
    if (q) {
      conditions.push(
        `(r.code ILIKE $${i} OR r.ref_pro ILIKE $${i} OR r.ref_four ILIKE $${i} OR r.diameter ILIKE $${i})`
      );
      params.push(`%${q}%`);
      i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM references_sku r ${where}`,
      params
    );
    const listRes = await query(
      `SELECT r.*, p.name AS product_name, p.brand
       FROM references_sku r
       JOIN products p ON p.id = r.product_id
       ${where}
       ORDER BY r.code
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    res.json({
      items: listRes.rows,
      page,
      limit,
      total: countRes.rows[0].total,
      totalPages: Math.ceil(countRes.rows[0].total / limit) || 1,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      code,
      product_id,
      ref_pro,
      ref_four,
      diameter,
      vendu_par,
      price_ht,
      note,
      image_path,
      stock,
      weight,
    } = req.body;
    if (!code?.trim() || !product_id) {
      return res.status(400).json({ error: 'code et product_id requis' });
    }
    const r = await query(
      `INSERT INTO references_sku
        (code, product_id, ref_pro, ref_four, diameter, vendu_par, price_ht, note, image_path, stock, weight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        String(code).trim(),
        product_id,
        ref_pro || null,
        ref_four || null,
        diameter || null,
        vendu_par || null,
        price_ht ?? null,
        note || null,
        image_path || null,
        stock ?? 0,
        weight ?? null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Code déjà existant' });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const {
      code,
      product_id,
      ref_pro,
      ref_four,
      diameter,
      vendu_par,
      price_ht,
      note,
      image_path,
      stock,
      weight,
    } = req.body;
    const r = await query(
      `UPDATE references_sku SET
         code = COALESCE($1, code),
         product_id = COALESCE($2, product_id),
         ref_pro = COALESCE($3, ref_pro),
         ref_four = COALESCE($4, ref_four),
         diameter = COALESCE($5, diameter),
         vendu_par = COALESCE($6, vendu_par),
         price_ht = COALESCE($7, price_ht),
         note = COALESCE($8, note),
         image_path = COALESCE($9, image_path),
         stock = COALESCE($10, stock),
         weight = COALESCE($11, weight),
         updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [
        code != null ? String(code).trim() : null,
        product_id ?? null,
        ref_pro ?? null,
        ref_four ?? null,
        diameter ?? null,
        vendu_par ?? null,
        price_ht ?? null,
        note ?? null,
        image_path ?? null,
        stock ?? null,
        weight ?? null,
        req.params.id,
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Introuvable' });
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM references_sku WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
