import { pool } from './db.js';

const sql = `
CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
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

ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS photo_paths TEXT;

-- Prix catalogue vs prix vente (marge)
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_catalog_ht NUMERIC(12, 4);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_sale_ht NUMERIC(12, 4);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_is_manual BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS offer_price_ht NUMERIC(12, 4);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS offer_label VARCHAR(255);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS offer_ends_at TIMESTAMPTZ;
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS variant_label VARCHAR(500);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS sort_order INT;
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_on_quote BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS edited_manually BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_sale_cdf NUMERIC(14, 2);
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS price_is_manual_cdf BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS internal_code VARCHAR(30);
-- Photo choisie à la main dans l'admin : l'import catalogue ne doit pas l'écraser.
ALTER TABLE references_sku ADD COLUMN IF NOT EXISTS image_edited_manually BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_edited_manually BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE families ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_internal_code ON references_sku (internal_code)
  WHERE internal_code IS NOT NULL;

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

-- Comptes clients (devis / commandes)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  address_line TEXT,
  city VARCHAR(100),
  contact_name VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200);

CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  quote_number VARCHAR(32) NOT NULL UNIQUE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  subtotal_ht NUMERIC(12, 4) NOT NULL DEFAULT 0,
  shipping_ht NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_ht NUMERIC(12, 4) NOT NULL DEFAULT 0,
  subtotal_cdf NUMERIC(14, 2),
  shipping_cdf NUMERIC(14, 2),
  total_cdf NUMERIC(14, 2),
  eur_to_cdf NUMERIC(10, 4),
  shipping_rule_name VARCHAR(255),
  valid_until DATE,
  customer_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);

CREATE TABLE IF NOT EXISTS quote_lines (
  id SERIAL PRIMARY KEY,
  quote_id INT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  reference_id INT REFERENCES references_sku(id) ON DELETE SET NULL,
  sku_code VARCHAR(20) NOT NULL,
  internal_code VARCHAR(30),
  ref_pro VARCHAR(100),
  product_name VARCHAR(500),
  variant_label VARCHAR(500),
  diameter VARCHAR(100),
  qty INT NOT NULL,
  unit_price_ht NUMERIC(12, 4),
  unit_price_cdf NUMERIC(14, 2),
  unit_price_usd NUMERIC(12, 4),
  line_total_ht NUMERIC(12, 4),
  line_total_cdf NUMERIC(14, 2),
  price_on_quote BOOLEAN NOT NULL DEFAULT false,
  sort_order INT
);

CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON quote_lines(quote_id);

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal_usd NUMERIC(12, 4);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS shipping_usd NUMERIC(12, 4);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_usd NUMERIC(12, 4);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS eur_to_usd NUMERIC(10, 4);
ALTER TABLE quote_lines ADD COLUMN IF NOT EXISTS line_total_usd NUMERIC(12, 4);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  quote_id INT NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE RESTRICT,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'received',
  subtotal_ht NUMERIC(12, 4) NOT NULL DEFAULT 0,
  shipping_ht NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_ht NUMERIC(12, 4) NOT NULL DEFAULT 0,
  subtotal_cdf NUMERIC(14, 2),
  shipping_cdf NUMERIC(14, 2),
  total_cdf NUMERIC(14, 2),
  subtotal_usd NUMERIC(12, 4),
  shipping_usd NUMERIC(12, 4),
  total_usd NUMERIC(12, 4),
  eur_to_cdf NUMERIC(10, 4),
  eur_to_usd NUMERIC(10, 4),
  shipping_rule_name VARCHAR(255),
  customer_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_lines (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reference_id INT REFERENCES references_sku(id) ON DELETE SET NULL,
  sku_code VARCHAR(20) NOT NULL,
  internal_code VARCHAR(30),
  ref_pro VARCHAR(100),
  product_name VARCHAR(500),
  variant_label VARCHAR(500),
  diameter VARCHAR(100),
  qty INT NOT NULL,
  unit_price_ht NUMERIC(12, 4),
  unit_price_cdf NUMERIC(14, 2),
  unit_price_usd NUMERIC(12, 4),
  line_total_ht NUMERIC(12, 4),
  line_total_cdf NUMERIC(14, 2),
  line_total_usd NUMERIC(12, 4),
  price_on_quote BOOLEAN NOT NULL DEFAULT false,
  sort_order INT
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE orders
SET payment_status = 'paid', paid_at = COALESCE(paid_at, created_at)
WHERE payment_status = 'pending' AND status = 'received' AND stripe_checkout_session_id IS NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
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
