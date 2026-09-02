import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { pool, query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: path.join(uploadDir, '_tmp'),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const router = Router();

router.use(requireAdmin);

function macHomeFolderAliases(p) {
  const out = [p];
  if (p.includes('/Bureau/')) out.push(p.replace('/Bureau/', '/Desktop/'));
  if (p.includes('/Desktop/')) out.push(p.replace('/Desktop/', '/Bureau/'));
  return [...new Set(out)];
}

function existingRealpath(p) {
  try {
    if (p && fs.existsSync(p)) return fs.realpathSync(p);
  } catch {
    /* ignore */
  }
  return path.resolve(p || '');
}

function resolveAllowedImagesDir(inputDir) {
  const raw = (inputDir || '').trim();
  if (!raw) return null;
  const resolvedCandidates = macHomeFolderAliases(raw).map(existingRealpath);
  const allowedRaw = (process.env.ALLOWED_IMAGES_DIRS || process.env.IMAGES_IMPORT_DIR || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedBases = allowedRaw.flatMap((s) => macHomeFolderAliases(s).map(existingRealpath));
  if (!allowedBases.length) return null;
  const matched = resolvedCandidates.find((resolved) =>
    allowedBases.some((base) => resolved === base || resolved.startsWith(`${base}${path.sep}`))
  );
  const exists = matched ? fs.existsSync(matched) : false;
  // #region agent log
  fetch('http://127.0.0.1:7581/ingest/20d23877-a71f-467f-86e2-87ccf471af2f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '913862' },
    body: JSON.stringify({
      sessionId: '913862',
      hypothesisId: 'A',
      location: 'import.js:resolveAllowedImagesDir',
      message: 'images dir allowlist check',
      data: {
        input: raw,
        envDir: process.env.IMAGES_IMPORT_DIR || '',
        matched: matched || null,
        exists,
        allowedBases,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return exists ? matched : null;
}

const COL_MAP = {
  'réf.pro': 'ref_pro',
  'ref.pro': 'ref_pro',
  'réf.pro.': 'ref_pro',
  'réf four': 'ref_four',
  'réf.four': 'ref_four',
  'ref.four': 'ref_four',
  diamètre: 'diameter',
  diametre: 'diameter',
  'vendu par': 'vendu_par',
  marque: 'brand',
  désignation: 'designation',
  designation: 'designation',
  code: 'code',
  famille: 'family',
  catégorie: 'category',
  categorie: 'category',
  'prix ht': 'price_ht',
  note: 'note',
  image: 'image',
};

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mapRow(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = COL_MAP[normalizeHeader(k)];
    if (key) out[key] = v == null || v === '' ? null : v;
  }
  return out;
}

function normStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normCode(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/\.0$/, '');
  return s === '' ? null : s;
}

function normPrice(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\s/g, '').replace(',', '.').replace('€', '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function same(a, b) {
  const na = a == null || a === '' ? null : String(a);
  const nb = b == null || b === '' ? null : String(b);
  if (na == null && nb == null) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    const fa = a == null ? null : Number(a);
    const fb = b == null ? null : Number(b);
    if (fa == null && fb == null) return true;
    return fa === fb;
  }
  return na === nb;
}

async function ensureFamily(client, name) {
  const n = normStr(name) || 'Non classé';
  const r = await client.query(
    `INSERT INTO families (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [n]
  );
  return r.rows[0].id;
}

async function ensureCategory(client, familyId, name) {
  const n = normStr(name) || 'Divers';
  const r = await client.query(
    `INSERT INTO categories (family_id, name) VALUES ($1, $2)
     ON CONFLICT (family_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [familyId, n]
  );
  return r.rows[0].id;
}

async function findOrCreateProduct(client, row, familyId, categoryId, imagePath) {
  const name = normStr(row.designation) || `Produit ${row.code}`;
  const brand = normStr(row.brand);

  const existing = await client.query(
    `SELECT id, name, brand, description, note, family_id, category_id, image_path
     FROM products
     WHERE name = $1
       AND COALESCE(brand,'') = COALESCE($2,'')
       AND COALESCE(category_id,0) = COALESCE($3,0)
     LIMIT 1`,
    [name, brand, categoryId]
  );

  if (existing.rows[0]) {
    const p = existing.rows[0];
    const updates = {};
    if (familyId && p.family_id !== familyId) updates.family_id = familyId;
    if (categoryId && p.category_id !== categoryId) updates.category_id = categoryId;
    if (imagePath && imagePath !== p.image_path) updates.image_path = imagePath;
    if (row.note && !p.note) updates.note = normStr(row.note);

    if (Object.keys(updates).length) {
      await client.query(
        `UPDATE products SET
           family_id = COALESCE($1, family_id),
           category_id = COALESCE($2, category_id),
           image_path = COALESCE($3, image_path),
           note = COALESCE($4, note),
           updated_at = NOW()
         WHERE id = $5`,
        [
          updates.family_id ?? null,
          updates.category_id ?? null,
          updates.image_path ?? null,
          updates.note ?? null,
          p.id,
        ]
      );
    }
    return p.id;
  }

  const r = await client.query(
    `INSERT INTO products (name, brand, description, note, family_id, category_id, image_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      name,
      brand,
      name,
      normStr(row.note),
      familyId,
      categoryId,
      imagePath,
    ]
  );
  return r.rows[0].id;
}

function resolveImagePath(row, imageMap) {
  const img = normStr(row.image);
  if (!img) return null;
  const normalized = img.replace(/\\/g, '/');
  const base = path.basename(normalized);
  const candidates = [
    base.toLowerCase(),
    normalized.toLowerCase(),
    normalized.split('/').slice(-2).join('/').toLowerCase(),
  ];
  for (const c of candidates) {
    if (imageMap.has(c)) return `/uploads/${imageMap.get(c)}`;
  }
  return null;
}

function ingestImageFile(srcPath, originalName, imageMap) {
  const safe = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!/\.(jpe?g|png|gif|webp|bmp)$/i.test(safe)) return false;
  const dest = path.join(uploadDir, safe);
  fs.copyFileSync(srcPath, dest);
  imageMap.set(safe.toLowerCase(), safe);
  imageMap.set(path.basename(originalName).toLowerCase(), safe);
  return true;
}

router.post(
  '/',
  upload.fields([
    { name: 'xlsx', maxCount: 1 },
    { name: 'images', maxCount: 20000 },
    { name: 'images_zip', maxCount: 1 },
  ]),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const xlsxFile = req.files?.xlsx?.[0];
      if (!xlsxFile) {
        return res.status(400).json({ error: 'Fichier xlsx requis (champ: xlsx)' });
      }

      const imageMap = new Map();
      let imagesImported = 0;
      const imageFiles = req.files?.images || [];
      for (const f of imageFiles) {
        const safe = f.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const dest = path.join(uploadDir, safe);
        fs.renameSync(f.path, dest);
        imageMap.set(safe.toLowerCase(), safe);
        imageMap.set(f.originalname.toLowerCase(), safe);
        imagesImported++;
      }

      const zipFile = req.files?.images_zip?.[0];
      if (zipFile) {
        const zip = new AdmZip(zipFile.path);
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue;
          const name = path.basename(entry.entryName);
          if (!/\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) continue;
          const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const dest = path.join(uploadDir, safe);
          fs.writeFileSync(dest, entry.getData());
          imageMap.set(safe.toLowerCase(), safe);
          imageMap.set(name.toLowerCase(), safe);
          imagesImported++;
        }
        try {
          fs.unlinkSync(zipFile.path);
        } catch {
          /* ignore */
        }
      }

      const imagesDir = resolveAllowedImagesDir(req.body.images_dir);
      if (imagesDir) {
        for (const name of fs.readdirSync(imagesDir)) {
          const full = path.join(imagesDir, name);
          if (!fs.statSync(full).isFile()) continue;
          if (ingestImageFile(full, name, imageMap)) imagesImported++;
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7581/ingest/20d23877-a71f-467f-86e2-87ccf471af2f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '913862' },
        body: JSON.stringify({
          sessionId: '913862',
          hypothesisId: 'B',
          location: 'import.js:POST',
          message: 'after images dir ingest',
          data: {
            bodyDir: req.body.images_dir || null,
            resolvedDir: imagesDir,
            imagesImported,
            mapSize: imageMap.size,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      const workbook = XLSX.readFile(xlsxFile.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

      let added = 0;
      let updated = 0;
      let unchanged = 0;
      let errors = 0;
      const errorSamples = [];

      await client.query('BEGIN');

      for (const raw of rawRows) {
        try {
          const row = mapRow(raw);
          const code = normCode(row.code);
          if (!code) {
            errors++;
            if (errorSamples.length < 20) errorSamples.push({ reason: 'Code manquant', raw });
            continue;
          }

          const familyId = await ensureFamily(client, row.family);
          const categoryId = await ensureCategory(client, familyId, row.category);
          const imagePath = resolveImagePath(row, imageMap);
          const productId = await findOrCreateProduct(
            client,
            row,
            familyId,
            categoryId,
            imagePath
          );

          const payload = {
            code,
            product_id: productId,
            ref_pro: normStr(row.ref_pro),
            ref_four: normStr(row.ref_four),
            diameter: normStr(row.diameter),
            vendu_par: normStr(row.vendu_par),
            price_catalog_ht: normPrice(row.price_ht),
            note: normStr(row.note),
            image_path: imagePath,
          };

          const existing = await client.query(
            `SELECT * FROM references_sku WHERE code = $1`,
            [code]
          );

          if (!existing.rows[0]) {
            await client.query(
              `INSERT INTO references_sku
                (code, product_id, ref_pro, ref_four, diameter, vendu_par, price_ht, price_catalog_ht, note, image_path)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)`,
              [
                payload.code,
                payload.product_id,
                payload.ref_pro,
                payload.ref_four,
                payload.diameter,
                payload.vendu_par,
                payload.price_catalog_ht,
                payload.note,
                payload.image_path,
              ]
            );
            added++;
          } else {
            const cur = existing.rows[0];
            const changed =
              !same(cur.product_id, payload.product_id) ||
              !same(cur.ref_pro, payload.ref_pro) ||
              !same(cur.ref_four, payload.ref_four) ||
              !same(cur.diameter, payload.diameter) ||
              !same(cur.vendu_par, payload.vendu_par) ||
              !same(cur.price_catalog_ht ?? cur.price_ht, payload.price_catalog_ht) ||
              !same(cur.note, payload.note) ||
              (payload.image_path && !same(cur.image_path, payload.image_path));

            if (changed) {
              await client.query(
                `UPDATE references_sku SET
                   product_id = $1,
                   ref_pro = $2,
                   ref_four = $3,
                   diameter = $4,
                   vendu_par = $5,
                   price_catalog_ht = $6,
                   price_ht = $6,
                   note = $7,
                   image_path = COALESCE($8, image_path),
                   updated_at = NOW()
                 WHERE code = $9`,
                [
                  payload.product_id,
                  payload.ref_pro,
                  payload.ref_four,
                  payload.diameter,
                  payload.vendu_par,
                  payload.price_catalog_ht,
                  payload.note,
                  payload.image_path,
                  code,
                ]
              );
              updated++;
            } else {
              unchanged++;
            }
          }
        } catch (rowErr) {
          errors++;
          if (errorSamples.length < 20) {
            errorSamples.push({ reason: rowErr.message, code: raw?.Code || raw?.code });
          }
        }
      }

      await client.query(
        `INSERT INTO import_logs (filename, added, updated, unchanged, errors, details)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          xlsxFile.originalname,
          added,
          updated,
          unchanged,
          errors,
          JSON.stringify({ errorSamples, images: imagesImported }),
        ]
      );

      await client.query('COMMIT');

      try {
        fs.unlinkSync(xlsxFile.path);
      } catch {
        /* ignore */
      }

      res.json({
        ok: true,
        filename: xlsxFile.originalname,
        rows: rawRows.length,
        added,
        updated,
        unchanged,
        errors,
        imagesImported,
        errorSamples,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      next(e);
    } finally {
      client.release();
    }
  }
);

router.get('/logs', async (_req, res, next) => {
  try {
    const r = await query(
      `SELECT id, filename, added, updated, unchanged, errors, created_at
       FROM import_logs ORDER BY created_at DESC LIMIT 20`
    );
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

export default router;
