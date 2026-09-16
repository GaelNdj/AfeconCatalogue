import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const expected = process.env.ADMIN_API_KEY;
    const isAdmin =
      Boolean(expected) && req.get('X-Admin-Key') === expected && req.query.all === '1';
    const families = await query(
      `SELECT f.*,
        (SELECT COUNT(DISTINCT p.id)::int FROM products p WHERE p.family_id = f.id) AS product_count
       FROM families f
       WHERE $1::boolean OR COALESCE(f.visible, true)
       ORDER BY f.sort_order, f.name`,
      [isAdmin]
    );
    const categories = await query(
      `SELECT c.*,
        (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c
       ORDER BY c.sort_order, c.name`
    );
    const byFamily = {};
    for (const c of categories.rows) {
      if (!byFamily[c.family_id]) byFamily[c.family_id] = [];
      byFamily[c.family_id].push(c);
    }
    const payload = families.rows.map((f) => ({
      ...f,
      categories: byFamily[f.id] || [],
    }));
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, sort_order = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
    const r = await query(
      `INSERT INTO families (name, sort_order) VALUES ($1, $2) RETURNING *`,
      [name.trim(), sort_order]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Famille déjà existante' });
    next(e);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, sort_order, visible } = req.body;
    const r = await query(
      `UPDATE families SET
         name = COALESCE($1, name),
         sort_order = COALESCE($2, sort_order),
         visible = COALESCE($3, visible),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [
        name?.trim() || null,
        sort_order ?? null,
        typeof visible === 'boolean' ? visible : null,
        req.params.id,
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Introuvable' });
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await query('DELETE FROM families WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/categories', requireAdmin, async (req, res, next) => {
  try {
    const { name, sort_order = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
    const r = await query(
      `INSERT INTO categories (family_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, name.trim(), sort_order]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Sous-famille déjà existante' });
    next(e);
  }
});

router.put('/categories/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, sort_order } = req.body;
    const r = await query(
      `UPDATE categories SET
         name = COALESCE($1, name),
         sort_order = COALESCE($2, sort_order),
         updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name?.trim() || null, sort_order ?? null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Introuvable' });
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res, next) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
