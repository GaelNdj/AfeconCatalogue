/**
 * Supprime les produits hors famille Plomberie et les fiches sans référence.
 * Les familles (Électricité, Chauffage, etc.) sont conservées pour les futurs imports.
 * Efface aussi les photos Legrand (legrand_*) hors catalogue Plomberie.
 *
 * Usage: node src/cleanup-non-plomberie.js
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

function deleteLegrandPhotos(dir) {
  if (!dir || !fs.existsSync(dir)) return { dir, deleted: 0, skipped: true };
  let deleted = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('legrand_')) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
      deleted += 1;
    } catch {
      /* ignore locked files */
    }
  }
  return { dir, deleted, skipped: false };
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const plomberie = await client.query(
      `SELECT id FROM families WHERE name ILIKE 'Plomberie' LIMIT 1`
    );
    const plomberieId = plomberie.rows[0]?.id;
    if (!plomberieId) {
      throw new Error('Famille Plomberie introuvable en base');
    }

    const elecFamily = await client.query(
      `SELECT id, name FROM families
       WHERE name IN ('Électricité', 'Electricite', 'Electricité')
          OR name ILIKE '%lectricit%'
       LIMIT 1`
    );
    const elecId = elecFamily.rows[0]?.id;
    if (!elecId) {
      throw new Error('Famille Électricité introuvable en base');
    }

    const beforeElec = await client.query(
      `SELECT COUNT(DISTINCT p.id)::int AS products, COUNT(r.id)::int AS refs
       FROM products p
       LEFT JOIN references_sku r ON r.product_id = p.id
       WHERE p.family_id = $1`,
      [elecId]
    );

    const delOther = await client.query(
      `DELETE FROM products p WHERE p.family_id = $1`,
      [elecId]
    );

    const catRes = await client.query(
      `DELETE FROM categories WHERE family_id = $1`,
      [elecId]
    );
    const delCats = catRes.rowCount;

    const delOrphans = await client.query(
      `DELETE FROM products p
       WHERE NOT EXISTS (SELECT 1 FROM references_sku r WHERE r.product_id = p.id)`
    );

    await client.query('COMMIT');

    const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || './uploads');
    const photoDirs = [
      uploadDir,
      '/Users/gael/Desktop/catalogue/images_hq',
    ];
    const photoStats = photoDirs.map(deleteLegrandPhotos);

    const stats = await client.query(
      `SELECT COUNT(DISTINCT p.id)::int AS products, COUNT(r.id)::int AS refs
       FROM products p
       LEFT JOIN references_sku r ON r.product_id = p.id
       WHERE p.family_id = $1`,
      [plomberieId]
    );

    console.log('Nettoyage terminé.');
    console.log(`  Produits hors Plomberie supprimés : ${delOther.rowCount}`);
    console.log(`  Catégories Électricité supprimées : ${delCats}`);
    console.log(`  Fiches sans référence supprimées   : ${delOrphans.rowCount}`);
    for (const s of photoStats) {
      console.log(`  Photos legrand_ ${s.dir} : ${s.skipped ? 'absent' : s.deleted + ' supprimées'}`);
    }
    console.log(`  Reste Plomberie : ${stats.rows[0].products} produits, ${stats.rows[0].refs} références`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
