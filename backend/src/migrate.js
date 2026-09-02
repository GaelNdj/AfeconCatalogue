import { pool } from './db.js';

const sql = `
CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, name)
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  brand VARCHAR(255),
  description TEXT,
  note TEXT,
  family_id INT REFERENCES families(id) ON DELETE SET NULL,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  image_path VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_family ON products(family_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

CREATE TABLE IF NOT EXISTS references_sku (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ref_pro VARCHAR(100),
  ref_four VARCHAR(100),
  diameter VARCHAR(100),
  vendu_par VARCHAR(50),
  price_ht NUMERIC(12, 4),
  note TEXT,
  image_path VARCHAR(500),
  stock INT NOT NULL DEFAULT 0,
  weight NUMERIC(10, 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_product ON references_sku(product_id);
CREATE INDEX IF NOT EXISTS idx_ref_code ON references_sku(code);
CREATE INDEX IF NOT EXISTS idx_ref_ref_pro ON references_sku(ref_pro);
CREATE INDEX IF NOT EXISTS idx_ref_search ON references_sku
  USING gin (to_tsvector('simple', coalesce(code,'') || ' ' || coalesce(ref_pro,'') || ' ' || coalesce(ref_four,'')));

CREATE TABLE IF NOT EXISTS import_logs (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(500),
  added INT NOT NULL DEFAULT 0,
  updated INT NOT NULL DEFAULT 0,
  unchanged INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(200),
  part_description TEXT NOT NULL,
  reference VARCHAR(200),
  brand VARCHAR(200),
  dimensions VARCHAR(200),
  message TEXT,
  searched_for VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created ON contact_inquiries(created_at DESC);

-- Prix catalogue vs prix vente (marge)
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_catalog_ht NUMERIC(12, 4);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_sale_ht NUMERIC(12, 4);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_is_manual BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS offer_price_ht NUMERIC(12, 4);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS offer_label VARCHAR(255);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS offer_ends_at TIMESTAMPTZ;

UPDATE references_sku
SET price_catalog_ht = price_ht
WHERE price_catalog_ht IS NULL AND price_ht IS NOT NULL;

CREATE TABLE IF NOT EXISTS margin_rules (
  id SERIAL PRIMARY KEY,
  family_id INT REFERENCES families(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE CASCADE,
  brand VARCHAR(255),
  margin_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
  fixed_markup NUMERIC(12, 4) NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 0,
  label VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_margin_rules_family ON margin_rules(family_id);

CREATE TABLE IF NOT EXISTS price_exceptions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  exception_type VARCHAR(32) NOT NULL DEFAULT 'manual_price',
  price_sale_ht NUMERIC(12, 4),
  margin_percent NUMERIC(6, 2),
  fixed_markup NUMERIC(12, 4) DEFAULT 0,
  offer_price_ht NUMERIC(12, 4),
  offer_label VARCHAR(255),
  offer_ends_at TIMESTAMPTZ,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(32) NOT NULL DEFAULT 'order_total',
  min_order_total NUMERIC(12, 4),
  max_order_total NUMERIC(12, 4),
  fee_ht NUMERIC(12, 4) NOT NULL DEFAULT 0,
  free_above NUMERIC(12, 4),
  family_id INT REFERENCES families(id) ON DELETE SET NULL,
  priority INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration OK');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
