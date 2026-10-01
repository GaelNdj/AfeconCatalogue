import { query } from '../db.js';

export const INACTIVE_AFTER_DAYS = 365;
export const DELETION_NOTICE_DAYS = 30;

const LIST_SQL = `
  SELECT
    u.id,
    u.email,
    u.company_name,
    u.contact_name,
    u.phone,
    u.city,
    u.created_at,
    u.last_login_at,
    u.status,
    u.deletion_scheduled_at,
    COALESCE(u.last_login_at, u.created_at) AS last_activity_at,
    (SELECT COUNT(*)::int FROM public.orders o WHERE o.user_id::text = u.id::text) AS order_count,
    (SELECT COUNT(*)::int FROM public.quotes q WHERE q.user_id::text = u.id::text) AS quote_count
  FROM public.users u
`;

export function isInactiveByActivity(lastActivityAt, now = new Date()) {
  if (!lastActivityAt) return true;
  const t = new Date(lastActivityAt).getTime();
  return now.getTime() - t >= INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export function toAdminAccount(row, now = new Date()) {
  const orderCount = Number(row.order_count) || 0;
  const inactive =
    row.status === 'inactive' ||
    row.status === 'pending_deletion' ||
    isInactiveByActivity(row.last_activity_at, now);
  const canDelete = orderCount === 0;
  return {
    id: row.id,
    email: row.email,
    company_name: row.company_name,
    contact_name: row.contact_name,
    phone: row.phone,
    city: row.city,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
    last_activity_at: row.last_activity_at,
    status: row.status,
    deletion_scheduled_at: row.deletion_scheduled_at,
    order_count: orderCount,
    quote_count: Number(row.quote_count) || 0,
    inactive,
    can_delete: canDelete,
  };
}

export async function getAccountById(id) {
  const r = await query(`${LIST_SQL} WHERE u.id = $1`, [id]);
  return r.rows[0] || null;
}

export async function listAccounts() {
  const r = await query(`${LIST_SQL} ORDER BY u.created_at DESC`);
  return r.rows.map((row) => toAdminAccount(row));
}

export async function markStaleAccountsInactive() {
  const r = await query(
    `UPDATE public.users
     SET status = 'inactive', updated_at = NOW()
     WHERE status = 'active'
       AND deletion_scheduled_at IS NULL
       AND COALESCE(last_login_at, created_at) < NOW() - ($1 || ' days')::interval
     RETURNING id`,
    [String(INACTIVE_AFTER_DAYS)]
  );
  return r.rowCount;
}

export async function applyDueDeletions() {
  const due = await query(
    `SELECT u.id
     FROM public.users u
     WHERE u.status = 'pending_deletion'
       AND u.deletion_scheduled_at IS NOT NULL
       AND u.deletion_scheduled_at <= NOW()
       AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id::text = u.id::text)`
  );
  const ids = due.rows.map((row) => row.id);
  if (!ids.length) return { deleted: 0, skippedWithOrders: 0 };

  const withOrders = await query(
    `SELECT u.id
     FROM public.users u
     WHERE u.status = 'pending_deletion'
       AND u.deletion_scheduled_at <= NOW()
       AND EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id::text = u.id::text)`
  );
  if (withOrders.rowCount) {
    await query(
      `UPDATE public.users
       SET status = 'inactive', deletion_scheduled_at = NULL, updated_at = NOW()
       WHERE id::text = ANY($1::text[])`,
      [withOrders.rows.map((row) => String(row.id))]
    );
  }

  const del = await query(`DELETE FROM public.users WHERE id::text = ANY($1::text[])`, [
    ids.map((id) => String(id)),
  ]);
  return { deleted: del.rowCount, skippedWithOrders: withOrders.rowCount };
}

async function warnIfForeignUsersTable() {
  const r = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
       AND column_name IN ('technician', 'team_id', 'color', 'role_id')`
  );
  if (r.rows.length) {
    console.warn(
      '[users] public.users existe déjà avec un schéma d’un autre projet — AfeconCatalogue réutilise cette table (id auto + colonnes catalogue). Base dédiée recommandée à terme.'
    );
  }
}

/** Railway : table users héritée sans SERIAL/UUID default → INSERT échoue (23502 sur id). */
export async function ensureUsersIdAutoGenerate() {
  const r = await query(
    `SELECT column_default, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'`
  );
  const col = r.rows[0];
  if (!col) return null;

  const hasDefault =
    col.column_default != null && String(col.column_default).trim().length > 0;
  if (hasDefault) return col.data_type;

  if (col.data_type === 'uuid') {
    await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await query(
      `ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid()`
    );
    console.log('[users] DEFAULT gen_random_uuid() sur users.id');
    return 'uuid';
  }

  if (col.data_type === 'integer' || col.udt_name === 'int4') {
    await query(`CREATE SEQUENCE IF NOT EXISTS public.users_id_seq`);
    await query(
      `ALTER TABLE public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass)`
    );
    await query(
      `SELECT setval(
        'public.users_id_seq',
        GREATEST(1, COALESCE((SELECT MAX(id) FROM public.users), 0) + 1),
        false
      )`
    );
    console.log('[users] DEFAULT nextval(users_id_seq) sur users.id');
    return 'integer';
  }

  console.warn('[users] users.id type non géré pour auto-génération:', col.data_type);
  return col.data_type;
}

async function ensureUserSessionsTable(userIdSqlType) {
  const fkType =
    userIdSqlType === 'uuid' ? 'UUID' : userIdSqlType === 'integer' ? 'INT' : 'INT';
  const exists = await query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'user_sessions'`
  );
  if (!exists.rows[0]) {
    await query(`
      CREATE TABLE public.user_sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id ${fkType} NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id)`);
    await query(`CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at)`);
    return;
  }

  const col = await query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = 'user_id'`
  );
  const sessionType = col.rows[0]?.data_type;
  const want = userIdSqlType === 'uuid' ? 'uuid' : 'integer';
  if (sessionType && sessionType !== want) {
    console.warn(
      `[users] user_sessions.user_id (${sessionType}) ≠ users.id (${want}) — connexion auto peut échouer ; supprimez user_sessions ou alignez les types.`
    );
  }
  await query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id)`);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at)`
  );
}

/** Tables/colonnes auth — utile si migrate n’a pas tout appliqué sur Railway. */
export async function ensureAuthSchema() {
  await warnIfForeignUsersTable();
  await ensureUserAccountColumns();
  const userIdType = await ensureUsersIdAutoGenerate();
  try {
    await ensureUserSessionsTable(userIdType);
  } catch (err) {
    console.error('[users] user_sessions ensure skipped:', err.message);
  }
}

export async function ensureUserAccountColumns() {
  const alters = [
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address_line TEXT`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200)`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status VARCHAR(32)`,
    `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ`,
  ];
  for (const sql of alters) {
    try {
      await query(sql);
    } catch (err) {
      console.error('[users] ensure column skipped:', err.message);
    }
  }
  try {
    await query(`UPDATE public.users SET status = 'active' WHERE status IS NULL`);
    await query(`ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'active'`);
  } catch (err) {
    console.error('[users] status default skipped:', err.message);
  }
}

export async function describeIdTypes() {
  const r = await query(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'users' AND column_name IN (
           'id', 'email', 'company_name', 'contact_name', 'phone', 'city',
           'address_line', 'created_at', 'status', 'last_login_at', 'deletion_scheduled_at'
         ))
         OR (table_name = 'orders' AND column_name IN ('id', 'user_id', 'quote_id'))
         OR (table_name = 'quotes' AND column_name IN ('id', 'user_id'))
       )
     ORDER BY table_name, column_name`
  );
  return r.rows;
}

export async function recordSuccessfulLogin(userId) {
  await query(
    `UPDATE public.users
     SET last_login_at = NOW(),
         status = 'active',
         deletion_scheduled_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}
