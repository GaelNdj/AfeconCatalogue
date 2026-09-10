/**
 * Supprime les produits hors famille Plomberie et les fiches sans référence.
 * Les familles (Électricité, Chauffage, etc.) sont conservées pour les futurs imports.
 *
 * Usage: node src/cleanup-non-plomberie.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

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

    const delOther = await client.query(
      `DELETE FROM products p WHERE p.family_id IS DISTINCT FROM $1`,
      [plomberieId]
    );

    const delOrphans = await client.query(
      `DELETE FROM products p
       WHERE NOT EXISTS (SELECT 1 FROM references_sku r WHERE r.product_id = p.id)`
    );

    await client.query('COMMIT');

    const stats = await client.query(
      `SELECT COUNT(DISTINCT p.id)::int AS products, COUNT(r.id)::int AS refs
       FROM products p
       LEFT JOIN references_sku r ON r.product_id = p.id
       WHERE p.family_id = $1`,
      [plomberieId]
    );

    console.log('Nettoyage terminé.');
    console.log(`  Produits hors Plomberie supprimés : ${delOther.rowCount}`);
    console.log(`  Fiches sans référence supprimées   : ${delOrphans.rowCount}`);
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
