import { pool } from './db.js';

async function seed() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS c FROM products');
    if (rows[0].c > 0) {
      console.log('Seed skipped — products already exist');
      return;
    }

    await client.query('BEGIN');

    const families = [
      { name: 'Plomberie', sort: 1 },
      { name: 'Électricité', sort: 2 },
      { name: 'Chauffage', sort: 3 },
    ];
    const familyIds = {};
    for (const f of families) {
      const r = await client.query(
        `INSERT INTO families (name, sort_order) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [f.name, f.sort]
      );
      familyIds[f.name] = r.rows[0].id;
    }

    const cats = [
      { family: 'Plomberie', name: 'Raccords laiton' },
      { family: 'Plomberie', name: 'Évacuation PVC' },
      { family: 'Électricité', name: 'Appareillage' },
      { family: 'Chauffage', name: 'Vannes' },
    ];
    const catIds = {};
    for (const c of cats) {
      const r = await client.query(
        `INSERT INTO categories (family_id, name) VALUES ($1, $2)
         ON CONFLICT (family_id, name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [familyIds[c.family], c.name]
      );
      catIds[`${c.family}/${c.name}`] = r.rows[0].id;
    }

    const products = [
      {
        name: 'Mamelon fileté laiton',
        brand: 'COMAP',
        description: 'Mamelon mâle-mâle en laiton, filetage cylindrique ISO 7',
        family: 'Plomberie',
        category: 'Raccords laiton',
        refs: [
          { code: '1000001', diameter: 'Ø 15x15', ref_pro: 'MAM-L-1515', ref_four: 'CMP-1515', price: 2.1, vendu: '1', stock: 540, weight: 0.06 },
          { code: '1000002', diameter: 'Ø 20x20', ref_pro: 'MAM-L-2020', ref_four: 'CMP-2020', price: 2.85, vendu: '1', stock: 320, weight: 0.09 },
          { code: '1000003', diameter: 'Ø 25x25', ref_pro: 'MAM-L-2525', ref_four: 'CMP-2525', price: 3.9, vendu: '1', stock: 180, weight: 0.14 },
          { code: '1000004', diameter: 'Ø 32x32', ref_pro: 'MAM-L-3232', ref_four: 'CMP-3232', price: 5.4, vendu: '1', stock: 95, weight: 0.22 },
          { code: '1000005', diameter: 'Ø 40x40', ref_pro: 'MAM-L-4040', ref_four: 'CMP-4040', price: 7.2, vendu: '1', stock: 60, weight: 0.31 },
        ],
      },
      {
        name: 'Manchon PVC évacuation',
        brand: 'NICOLL',
        description: 'Manchon à coller PVC NF pour évacuation eaux usées',
        family: 'Plomberie',
        category: 'Évacuation PVC',
        refs: [
          { code: '1000010', diameter: 'Ø 32', ref_pro: 'MAN-PVC-32', ref_four: 'NIC-32', price: 0.85, vendu: '10', stock: 1200, weight: 0.03 },
          { code: '1000011', diameter: 'Ø 40', ref_pro: 'MAN-PVC-40', ref_four: 'NIC-40', price: 1.05, vendu: '10', stock: 900, weight: 0.04 },
          { code: '1000012', diameter: 'Ø 50', ref_pro: 'MAN-PVC-50', ref_four: 'NIC-50', price: 1.45, vendu: '5', stock: 650, weight: 0.06 },
        ],
      },
      {
        name: 'Interrupteur bipolaire',
        brand: 'LEGRAND',
        description: 'Interrupteur va-et-vient, intensité 16A, NF C 15-100',
        family: 'Électricité',
        category: 'Appareillage',
        refs: [
          { code: '2000001', diameter: '2 modules', ref_pro: 'INT-BP-20A', ref_four: 'LEG-7722', price: 9.9, vendu: '1', stock: 210, weight: 0.08 },
          { code: '2000002', diameter: 'Va-et-vient', ref_pro: 'INT-VV-16A', ref_four: 'LEG-7701', price: 6.5, vendu: '1', stock: 340, weight: 0.07 },
          { code: '2000003', diameter: 'Poussoir', ref_pro: 'INT-PS-16A', ref_four: 'LEG-7705', price: 7.2, vendu: '1', stock: 150, weight: 0.07 },
        ],
      },
      {
        name: 'Disjoncteur différentiel',
        brand: 'LEGRAND',
        description: 'Disjoncteur différentiel 30mA type AC',
        family: 'Électricité',
        category: 'Appareillage',
        refs: [
          { code: '2000010', diameter: '16A 2P', ref_pro: 'DD-16-2P', ref_four: 'LEG-4115', price: 48.5, vendu: '1', stock: 80, weight: 0.22 },
          { code: '2000011', diameter: '20A 2P', ref_pro: 'DD-20-2P', ref_four: 'LEG-4116', price: 52.0, vendu: '1', stock: 65, weight: 0.22 },
        ],
      },
      {
        name: 'Vanne thermostatiquie',
        brand: 'DANFOSS',
        description: 'Tête thermostatique radiateur, plage 8–28°C',
        family: 'Chauffage',
        category: 'Vannes',
        refs: [
          { code: '3000001', diameter: 'RA-N 15', ref_pro: 'VT-RAN-15', ref_four: 'DF-013G', price: 18.9, vendu: '1', stock: 120, weight: 0.15 },
          { code: '3000002', diameter: 'RA-N 20', ref_pro: 'VT-RAN-20', ref_four: 'DF-013H', price: 21.5, vendu: '1', stock: 90, weight: 0.18 },
        ],
      },
      {
        name: 'Raccord à compression multicouche',
        brand: 'COMAP',
        description: 'Raccord droit à compression multicouche PER/AL/PER',
        family: 'Plomberie',
        category: 'Raccords laiton',
        refs: [
          { code: '1000020', diameter: 'Ø 16', ref_pro: 'RC-MC-16', ref_four: 'CMP-M16', price: 4.2, vendu: '1', stock: 400, weight: 0.05 },
          { code: '1000021', diameter: 'Ø 20', ref_pro: 'RC-MC-20', ref_four: 'CMP-M20', price: 5.1, vendu: '1', stock: 280, weight: 0.07 },
        ],
      },
    ];

    for (const p of products) {
      const pr = await client.query(
        `INSERT INTO products (name, brand, description, family_id, category_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          p.name,
          p.brand,
          p.description,
          familyIds[p.family],
          catIds[`${p.family}/${p.category}`],
        ]
      );
      const productId = pr.rows[0].id;
      for (const ref of p.refs) {
        await client.query(
          `INSERT INTO references_sku
            (code, product_id, ref_pro, ref_four, diameter, vendu_par, price_ht, price_catalog_ht, stock, weight)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)
           ON CONFLICT (code) DO NOTHING`,
          [
            ref.code,
            productId,
            ref.ref_pro,
            ref.ref_four,
            ref.diameter,
            ref.vendu,
            ref.price,
            ref.stock,
            ref.weight,
          ]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Seed OK — 6 produits démo');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
