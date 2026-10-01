import { query } from '../db.js';

/** Comptes clients AfeconCatalogue — séparés de public.users (autres apps sur le même Postgres Railway). */
export const CATALOGUE_USERS = 'catalogue_users';
export const CATALOGUE_USER_SESSIONS = 'catalogue_user_sessions';

export async function isForeignUsersTable() {
  const r = await query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
       AND column_name IN ('organization_id', 'technician', 'team_id')
     LIMIT 1`
  );
  return Boolean(r.rows[0]);
}

export async function ensureCatalogueAuthSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.catalogue_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      company_name VARCHAR(255),
      phone VARCHAR(50),
      address_line TEXT,
      city VARCHAR(100),
      contact_name VARCHAR(200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      deletion_scheduled_at TIMESTAMPTZ
    )
  `);

  const alters = [
    `ALTER TABLE public.catalogue_users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)`,
    `ALTER TABLE public.catalogue_users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`,
    `ALTER TABLE public.catalogue_users ADD COLUMN IF NOT EXISTS address_line TEXT`,
    `ALTER TABLE public.catalogue_users ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
    `ALTER TABLE public.catalogue_users ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200)`,
    `ALTER TABLE public.catalogue_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
    `ALTER TABLE public.catalogue_users ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active'`,
    `ALTER TABLE public.catalogue_users ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ`,
  ];
  for (const sql of alters) {
    try {
      await query(sql);
    } catch (err) {
      console.error('[catalogue_users] column skipped:', err.message);
    }
  }

  await query(`
    CREATE TABLE IF NOT EXISTS public.catalogue_user_sessions (
      id VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL REFERENCES public.catalogue_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_catalogue_user_sessions_user ON public.catalogue_user_sessions(user_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_catalogue_user_sessions_expires ON public.catalogue_user_sessions(expires_at)`
  );

  if (await isForeignUsersTable()) {
    console.log(
      '[catalogue_users] public.users ignorée (autre application) — auth catalogue sur catalogue_users'
    );
    return;
  }

  const legacy = await query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'users'`
  );
  if (!legacy.rows[0]) return;

  try {
    await query(`
      INSERT INTO public.catalogue_users (
        id, email, password_hash, company_name, phone, address_line, city,
        contact_name, created_at, updated_at, last_login_at, status, deletion_scheduled_at
      )
      SELECT
        u.id, u.email, u.password_hash, u.company_name, u.phone, u.address_line, u.city,
        u.contact_name, u.created_at, u.updated_at, u.last_login_at,
        COALESCE(u.status, 'active'), u.deletion_scheduled_at
      FROM public.users u
      WHERE u.password_hash IS NOT NULL
      ON CONFLICT (email) DO NOTHING
    `);
    await query(`
      SELECT setval(
        pg_get_serial_sequence('public.catalogue_users', 'id'),
        GREATEST(1, COALESCE((SELECT MAX(id) FROM public.catalogue_users), 1))
      )
    `);
  } catch (err) {
    console.error('[catalogue_users] copie depuis users ignorée:', err.message);
  }
}
