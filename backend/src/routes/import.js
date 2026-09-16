import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { pool, query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { assignMissingAfeCodes } from '../internalCode.js';

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
  const catalogueRoots = [
    '/Users/gael/Desktop/catalogue',
    '/Users/gael/Bureau/catalogue',
  ].flatMap((s) => macHomeFolderAliases(s).map(existingRealpath));
  const allowedBases = [
    ...allowedRaw.flatMap((s) => macHomeFolderAliases(s).map(existingRealpath)),
    ...catalogueRoots,
  ];
  const uniqueBases = [...new Set(allowedBases)];
  if (!uniqueBases.length) return null;
  const matched = resolvedCandidates.find((resolved) =>
    uniqueBases.some((base) => resolved === base || resolved.startsWith(`${base}${path.sep}`))
  );
  const exists = matched ? fs.existsSync(matched) : false;
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
  variante: 'variant_label',
  'désignation variante': 'variant_label',
  ordre: 'sort_order',
  code: 'code',
  'code interne': 'internal_code',
  'code afecon': 'internal_code',
  'code afe-con': 'internal_code',
  'code afe': 'internal_code',
  famille: 'family',
  catégorie: 'category',
  categorie: 'category',
  'prix ht': 'price_ht',
  'note': 'note',
  description: 'description',
  'description courte': 'description',
  image: 'image',
  'image produit': 'product_image',
  'image_produit': 'product_image',
  // Export Legrand
  référence: 'code',
  reference: 'code',
  gencod: 'ref_four',
  'tarif unitaire ht': 'price_ht',
  'conditionnement de base': 'vendu_par',
  'libellé famille remise': 'category',
  'libelle famille remise': 'category',
  'lien vers fiche produit legrand.fr': 'image',
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

function normInternalCode(v) {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase().replace(/\s+/g, '');
  return s === '' ? null : s;
}

function normPrice(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\s/g, '').replace(',', '.').replace('€', '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const PRICE_COURS_RE = /prix\s*[àa]?\s*cours/i;

function parsePriceCell(v) {
  if (v == null || v === '') return { catalog: null, onQuote: false };
  if (typeof v === 'number') return { catalog: v, onQuote: false };
  const raw = String(v).trim();
  if (PRICE_COURS_RE.test(raw)) return { catalog: null, onQuote: true };
  return { catalog: normPrice(raw), onQuote: false };
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

function resolveImportMode(raw) {
  const m = String(raw || 'sync').trim().toLowerCase();
  return m === 'full' ? 'full' : 'sync';
}

/** En mode sync : ne fige que les prix vente / codes AFE admin — le catalogue (nom, variante, Ø) reste à jour. */
function effectivePayloadForUpdate(cur, payload, importMode) {
  // Une photo choisie à la main dans l'admin est conservée dans tous les modes :
  // sinon l'outil de correction des photos perdrait son sens au réimport.
  const base = cur.image_edited_manually
    ? { ...payload, image_path: cur.image_path }
    : payload;
  const sync = importMode === 'sync';
  const protectedRef = sync && cur.edited_manually;
  if (!protectedRef) {
    return { eff: base, protectedRef: false };
  }
  return {
    eff: {
      ...base,
      internal_code: cur.internal_code,
      price_sale_cdf: cur.price_sale_cdf,
      price_is_manual_cdf: cur.price_is_manual_cdf,
      image_path: base.image_path || cur.image_path,
    },
    protectedRef: true,
  };
}

function referenceRowChanged(cur, eff) {
  return (
    !same(cur.product_id, eff.product_id) ||
    !same(cur.ref_pro, eff.ref_pro) ||
    !same(cur.ref_four, eff.ref_four) ||
    !same(cur.diameter, eff.diameter) ||
    !same(cur.vendu_par, eff.vendu_par) ||
    !same(cur.price_catalog_ht ?? cur.price_ht, eff.price_catalog_ht) ||
    !same(cur.price_on_quote, eff.price_on_quote) ||
    !same(cur.note, eff.note) ||
    !same(cur.variant_label, eff.variant_label) ||
    !same(cur.sort_order, eff.sort_order) ||
    !same(cur.internal_code, eff.internal_code) ||
    (eff.image_path && !same(cur.image_path, eff.image_path))
  );
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
  const hero = imagePath || null;

  // Même nom + même catégorie + même marque : deux blocs catalogue (Virax /
  // Rothenberger) restent distincts grâce à la photo principale du bloc.
  const existing = await client.query(
    `SELECT id, name, brand, description, note, family_id, category_id, image_path,
            image_edited_manually
     FROM products
     WHERE name = $1
       AND COALESCE(brand,'') = COALESCE($2,'')
       AND COALESCE(category_id,0) = COALESCE($3,0)
       AND COALESCE(image_path,'') = COALESCE($4,'')
     LIMIT 1`,
    [name, brand, categoryId, hero]
  );

  if (existing.rows[0]) {
    const p = existing.rows[0];
    const updates = {};
    if (familyId && p.family_id !== familyId) updates.family_id = familyId;
    if (categoryId && p.category_id !== categoryId) updates.category_id = categoryId;
    if (row.note && !p.note) updates.note = normStr(row.note);
    if (row.description) updates.description = normStr(row.description);
    if (name && p.name !== name) updates.name = name;

    if (Object.keys(updates).length) {
      await client.query(
        `UPDATE products SET
           family_id = COALESCE($1, family_id),
           category_id = COALESCE($2, category_id),
           note = COALESCE($3, note),
           description = COALESCE($4, description),
           updated_at = NOW()
         WHERE id = $5`,
        [
          updates.family_id ?? null,
          updates.category_id ?? null,
          updates.note ?? null,
          updates.description ?? null,
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
      normStr(row.description) || null,
      normStr(row.note),
      familyId,
      categoryId,
      hero,
    ]
  );
  return r.rows[0].id;
}

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || ''));
}

function imageExtFromContentType(ct, url) {
  const t = String(ct || '').toLowerCase();
  if (t.includes('png')) return '.png';
  if (t.includes('webp')) return '.webp';
  if (t.includes('gif')) return '.gif';
  const m = String(url || '').match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  if (m) return `.${m[1].toLowerCase().replace('jpeg', 'jpg')}`;
  return '.jpg';
}

async function downloadImageFromUrl(url, code, imageMap) {
  const normalized = String(url).trim();
  if (!isHttpUrl(normalized)) return null;
  const cacheKey = `url:${normalized.toLowerCase()}`;
  if (imageMap.has(cacheKey)) return imageMap.get(cacheKey);

  try {
    const res = await fetch(normalized, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return null;
    const ext = imageExtFromContentType(ct, normalized);
    const safeCode = String(code || 'img').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `import_${safeCode}${ext}`;
    const dest = path.join(uploadDir, filename);
    fs.writeFileSync(dest, buf);
    const publicPath = `/uploads/${filename}`;
    imageMap.set(cacheKey, publicPath);
    imageMap.set(filename.toLowerCase(), filename);
    return publicPath;
  } catch {
    return null;
  }
}

function resolveImagePath(row, imageMap, field = 'image') {
  const img = normStr(row[field]);
  if (!img) return null;
  if (isHttpUrl(img)) {
    const cached = imageMap.get(`url:${img.toLowerCase()}`);
    if (cached) return cached;
    return null;
  }
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

      const workbook = XLSX.readFile(xlsxFile.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const importMode = resolveImportMode(req.body.import_mode);
      const downloadImageUrls =
        req.body.download_image_urls === '1' || req.body.download_image_urls === 'true';

      let added = 0;
      let updated = 0;
      let unchanged = 0;
      let catalogSynced = 0;
      let protectedSkipped = 0;
      let errors = 0;
      const errorSamples = [];

      await client.query('BEGIN');

      for (const raw of rawRows) {
        try {
          const row = mapRow(raw);
          if (!row.ref_pro && row.code) row.ref_pro = String(row.code);
          if (!row.code && row.ref_pro) row.code = String(row.ref_pro);
          const code = normCode(row.code);
          if (!code) {
            errors++;
            if (errorSamples.length < 20) errorSamples.push({ reason: 'Code manquant', raw });
            continue;
          }

          const familyId = await ensureFamily(client, row.family);
          const categoryId = await ensureCategory(client, familyId, row.category);
          let skuImagePath = resolveImagePath(row, imageMap, 'image');
          if (!skuImagePath && downloadImageUrls && isHttpUrl(row.image)) {
            skuImagePath = await downloadImageFromUrl(row.image, code, imageMap);
            if (skuImagePath) imagesImported++;
          }
          const productImagePath =
            resolveImagePath(row, imageMap, 'product_image') || skuImagePath;
          let productId = await findOrCreateProduct(
            client,
            row,
            familyId,
            categoryId,
            productImagePath
          );

          const priceInfo = parsePriceCell(row.price_ht);
          const payload = {
            code,
            internal_code: normInternalCode(row.internal_code),
            product_id: productId,
            ref_pro: normStr(row.ref_pro),
            ref_four: normStr(row.ref_four),
            diameter: normStr(row.diameter),
            vendu_par: normStr(row.vendu_par),
            price_catalog_ht: priceInfo.catalog,
            price_on_quote: priceInfo.onQuote,
            note: normStr(row.note),
            variant_label: normStr(row.variant_label),
            sort_order: row.sort_order == null || row.sort_order === '' ? null : parseInt(row.sort_order, 10) || null,
            image_path: skuImagePath,
          };

          const existing = await client.query(
            `SELECT * FROM references_sku WHERE code = $1`,
            [code]
          );

            if (existing.rows[0]) {
            const prevProductId = existing.rows[0].product_id;
            payload.product_id = productId;
            if (prevProductId && prevProductId !== productId) {
              await client.query(
                `UPDATE products np
                 SET image_path = COALESCE(np.image_path, op.image_path)
                 FROM products op
                 WHERE np.id = $1 AND op.id = $2
                   AND NOT np.image_edited_manually`,
                [productId, prevProductId]
              );
            }
            await client.query(
              `UPDATE products SET
                 name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 brand = COALESCE($3, brand),
                 category_id = COALESCE($4, category_id),
                 family_id = COALESCE($5, family_id),
                 image_path = CASE
                   WHEN image_edited_manually THEN image_path
                   ELSE COALESCE($6, image_path)
                 END,
                 updated_at = NOW()
               WHERE id = $7`,
              [
                normStr(row.designation),
                normStr(row.description),
                normStr(row.brand),
                categoryId,
                familyId,
                productImagePath || null,
                productId,
              ]
            );
          }

          if (!existing.rows[0]) {
            await client.query(
              `INSERT INTO references_sku
                (code, internal_code, product_id, ref_pro, ref_four, diameter, vendu_par, price_ht, price_catalog_ht,
                 price_on_quote, note, variant_label, sort_order, image_path)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13)`,
              [
                payload.code,
                payload.internal_code,
                payload.product_id,
                payload.ref_pro,
                payload.ref_four,
                payload.diameter,
                payload.vendu_par,
                payload.price_catalog_ht,
                payload.price_on_quote,
                payload.note,
                payload.variant_label,
                Number.isFinite(payload.sort_order) ? payload.sort_order : null,
                payload.image_path,
              ]
            );
            added++;
          } else {
            const cur = existing.rows[0];
            const { eff, protectedRef } = effectivePayloadForUpdate(cur, payload, importMode);
            const changed = referenceRowChanged(cur, eff);

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
                   price_on_quote = $7,
                   note = $8,
                   variant_label = $9,
                   sort_order = $10,
                   internal_code = COALESCE($11, internal_code),
                   image_path = COALESCE($12, image_path),
                   updated_at = NOW()
                 WHERE code = $13`,
                [
                  eff.product_id,
                  eff.ref_pro,
                  eff.ref_four,
                  eff.diameter,
                  eff.vendu_par,
                  eff.price_catalog_ht,
                  eff.price_on_quote,
                  eff.note,
                  eff.variant_label,
                  Number.isFinite(eff.sort_order) ? eff.sort_order : null,
                  eff.internal_code,
                  eff.image_path,
                  code,
                ]
              );
              updated++;
              if (protectedRef) catalogSynced++;
            } else {
              unchanged++;
              if (protectedRef) protectedSkipped++;
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
        `DELETE FROM products p
         WHERE NOT EXISTS (SELECT 1 FROM references_sku r WHERE r.product_id = p.id)`
      );

      const afeFill = await assignMissingAfeCodes(client);

      await client.query(
        `INSERT INTO import_logs (filename, added, updated, unchanged, errors, details)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          xlsxFile.originalname,
          added,
          updated,
          unchanged,
          errors,
          JSON.stringify({
            errorSamples,
            images: imagesImported,
            downloadImageUrls,
            importMode,
            catalogSynced,
            protectedSkipped,
            afeAssigned: afeFill.n,
          }),
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
        importMode,
        added,
        updated,
        unchanged,
        catalogSynced,
        protectedSkipped,
        errors,
        imagesImported,
        afeAssigned: afeFill.n,
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
