import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { enrichReferencesPublic } from '../pricingLoader.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '24', 10)));
    const offset = (page - 1) * limit;
    const q = (req.query.q || '').trim();
    const familyId = req.query.family_id || null;
    const categoryId = req.query.category_id || null;

    const conditions = [];
    const params = [];
    let i = 1;

    if (familyId) {
      conditions.push(`p.family_id = $${i++}`);
      params.push(familyId);
    }
    if (categoryId) {
      conditions.push(`p.category_id = $${i++}`);
      params.push(categoryId);
    }
    // Catalogue public : masquer les fiches sans référence vendable
    conditions.push(`EXISTS (SELECT 1 FROM references_sku r WHERE r.product_id = p.id)`);
    const expected = process.env.ADMIN_API_KEY;
    const isAdminList = Boolean(expected) && req.get('X-Admin-Key') === expected;
    if (!isAdminList) {
      conditions.push(
        `(p.family_id IS NULL OR EXISTS (
           SELECT 1 FROM families vis WHERE vis.id = p.family_id AND COALESCE(vis.visible, true)
         ))`
      );
    }
    if (q) {
      conditions.push(`(
        p.name ILIKE $${i} OR p.brand ILIKE $${i} OR p.description ILIKE $${i}
        OR EXISTS (
          SELECT 1 FROM references_sku r
          WHERE r.product_id = p.id
            AND (r.code ILIKE $${i} OR r.internal_code ILIKE $${i}
              OR r.ref_pro ILIKE $${i} OR r.ref_four ILIKE $${i})
        )
      )`);
      params.push(`%${q}%`);
      i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM products p ${where}`,
      params
    );

    const listParams = [...params, limit, offset];
    const listRes = await query(
      `SELECT p.*,
         f.name AS family_name,
         c.name AS category_name,
         (SELECT COUNT(*)::int FROM references_sku r WHERE r.product_id = p.id) AS ref_count,
         COALESCE(
           p.image_path,
           (SELECT r.image_path FROM references_sku r WHERE r.product_id = p.id AND r.image_path IS NOT NULL LIMIT 1)
         ) AS display_image
       FROM products p
       LEFT JOIN families f ON f.id = p.family_id
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.name ASC
       LIMIT $${i++} OFFSET $${i++}`,
      listParams
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

router.get('/:id', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT p.*,
         f.name AS family_name,
         c.name AS category_name
       FROM products p
       LEFT JOIN families f ON f.id = p.family_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Produit introuvable' });

    const refs = await query(
      `SELECT * FROM references_sku WHERE product_id = $1
       ORDER BY sort_order NULLS LAST, code`,
      [req.params.id]
    );

    const product = r.rows[0];
    const enriched = await enrichReferencesPublic(refs.rows, product);

    res.json({ ...product, references: enriched });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, brand, description, note, family_id, category_id, image_path } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });
    const r = await query(
      `INSERT INTO products (name, brand, description, note, family_id, category_id, image_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        name.trim(),
        brand || null,
        description || null,
        note || null,
        family_id || null,
        category_id || null,
        image_path || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, brand, description, note, family_id, category_id, image_path } = req.body;
    const r = await query(
      `UPDATE products SET
         name = COALESCE($1, name),
         brand = COALESCE($2, brand),
         description = COALESCE($3, description),
         note = COALESCE($4, note),
         family_id = COALESCE($5, family_id),
         category_id = COALESCE($6, category_id),
         image_path = CASE WHEN $9 THEN $7 ELSE image_path END,
         image_edited_manually = CASE
           WHEN $9 AND NOT COALESCE(image_path, '') = COALESCE($7, '') THEN true
           ELSE image_edited_manually
         END,
         updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [
        name?.trim() || null,
        brand ?? null,
        description ?? null,
        note ?? null,
        family_id ?? null,
        category_id ?? null,
        // Chaîne vide = retirer la photo ; champ absent = ne pas y toucher.
        String(image_path ?? '').trim() || null,
        req.params.id,
        image_path !== undefined,
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
    await query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
