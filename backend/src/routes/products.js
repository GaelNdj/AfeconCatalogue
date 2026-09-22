import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { enrichReferencesPublic } from '../pricingLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.join(uploadDir, '_tmp'), { recursive: true });

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/** Prix public le plus bas par fiche (même calcul que la page produit). */
async function attachStartingPrices(products) {
  if (!products.length) return products;
  const ids = products.map((p) => p.id);
  const refs = await query(`SELECT * FROM references_sku WHERE product_id = ANY($1::int[])`, [ids]);
  const byProduct = new Map();
  for (const ref of refs.rows) {
    const list = byProduct.get(ref.product_id) || [];
    list.push(ref);
    byProduct.set(ref.product_id, list);
  }

  const items = [];
  for (const product of products) {
    const enriched = await enrichReferencesPublic(byProduct.get(product.id) || [], product);
    const priced = enriched.filter(
      (r) => r.display_price_cdf != null && r.price_source !== 'quote' && !r.price_on_quote
    );
    priced.sort((a, b) => a.display_price_cdf - b.display_price_cdf);
    const min = priced[0] || null;
    items.push({
      ...product,
      price_from_cdf: min?.display_price_cdf ?? null,
      price_from_usd: min?.display_price_usd ?? null,
      price_from_multiple: priced.length > 1,
      price_on_quote_only: !min && enriched.some((r) => r.price_on_quote || r.price_source === 'quote'),
    });
  }
  return items;
}

const imageUpload = multer({
  dest: path.join(uploadDir, '_tmp'),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error('Formats acceptés : JPG, PNG, WEBP, GIF'));
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (mime && mime !== 'application/octet-stream' && !mime.startsWith('image/')) {
      return cb(new Error('Formats acceptés : JPG, PNG, WEBP, GIF'));
    }
    cb(null, true);
  },
});

function uniqueUploadPath(originalName) {
  const safe = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(safe).toLowerCase() || '.jpg';
  const base = path.basename(safe, path.extname(safe)) || 'photo';
  let filename = `${base}${ext}`;
  let dest = path.join(uploadDir, filename);
  let n = 1;
  while (fs.existsSync(dest)) {
    filename = `${base}_${n}${ext}`;
    dest = path.join(uploadDir, filename);
    n += 1;
  }
  return { dest, publicPath: `/uploads/${filename}` };
}

const router = Router();

router.post('/upload-image', requireAdmin, (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        error: tooBig ? 'Image trop lourde (max 8 Mo)' : err.message || 'Upload impossible',
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier image requis' });
    }
    try {
      const { dest, publicPath } = uniqueUploadPath(req.file.originalname);
      fs.renameSync(req.file.path, dest);
      res.status(201).json({ image_path: publicPath });
    } catch (e) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      next(e);
    }
  });
});

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

    const items = await attachStartingPrices(listRes.rows);

    res.json({
      items,
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
