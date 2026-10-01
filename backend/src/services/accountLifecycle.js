import { query } from '../db.js';
import { CATALOGUE_USERS } from '../auth/catalogueUsers.js';

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
  FROM public.${CATALOGUE_USERS} u
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
    `UPDATE public.${CATALOGUE_USERS}
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
     FROM public.${CATALOGUE_USERS} u
     WHERE u.status = 'pending_deletion'
       AND u.deletion_scheduled_at IS NOT NULL
       AND u.deletion_scheduled_at <= NOW()
       AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id::text = u.id::text)`
  );
  const ids = due.rows.map((row) => row.id);
  if (!ids.length) return { deleted: 0, skippedWithOrders: 0 };

  const withOrders = await query(
    `SELECT u.id
     FROM public.${CATALOGUE_USERS} u
     WHERE u.status = 'pending_deletion'
       AND u.deletion_scheduled_at <= NOW()
       AND EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id::text = u.id::text)`
  );
  if (withOrders.rowCount) {
    await query(
      `UPDATE public.${CATALOGUE_USERS}
       SET status = 'inactive', deletion_scheduled_at = NULL, updated_at = NOW()
       WHERE id::text = ANY($1::text[])`,
      [withOrders.rows.map((row) => String(row.id))]
    );
  }

  const del = await query(`DELETE FROM public.${CATALOGUE_USERS} WHERE id::text = ANY($1::text[])`, [
    ids.map((id) => String(id)),
  ]);
  return { deleted: del.rowCount, skippedWithOrders: withOrders.rowCount };
}

/** @deprecated utilisez ensureCatalogueAuthSchema */
export async function ensureAuthSchema() {
  const { ensureCatalogueAuthSchema } = await import('../auth/catalogueUsers.js');
  await ensureCatalogueAuthSchema();
}

export async function ensureUserAccountColumns() {
  const { ensureCatalogueAuthSchema } = await import('../auth/catalogueUsers.js');
  await ensureCatalogueAuthSchema();
}

export async function describeIdTypes() {
  const r = await query(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = $1 AND column_name IN (
           'id', 'email', 'company_name', 'contact_name', 'phone', 'city',
           'address_line', 'created_at', 'status', 'last_login_at', 'deletion_scheduled_at'
         ))
         OR (table_name = 'orders' AND column_name IN ('id', 'user_id', 'quote_id'))
         OR (table_name = 'quotes' AND column_name IN ('id', 'user_id'))
       )
     ORDER BY table_name, column_name`,
    [CATALOGUE_USERS]
  );
  return r.rows;
}

export async function recordSuccessfulLogin(userId) {
  await query(
    `UPDATE public.${CATALOGUE_USERS}
     SET last_login_at = NOW(),
         status = 'active',
         deletion_scheduled_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}
